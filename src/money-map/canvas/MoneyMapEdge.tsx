import type { PointerEvent as ReactPointerEvent } from "react";
import { BaseEdge, EdgeLabelRenderer, type EdgeProps } from "@xyflow/react";

import { InlineField } from "../editor/InlineField";
import type { Point } from "../model/types";
import type { MoneyMapCanvasEdge } from "./adapters";
import { relationshipGeometry } from "./relationshipGeometry";

const DRAG_THRESHOLD = 6;

export function pointerMovedBeyondThreshold(start: Point, end: Point): boolean {
  return Math.hypot(end.x - start.x, end.y - start.y) > DRAG_THRESHOLD;
}

export function MoneyMapEdge({
  data,
  markerEnd,
  selected,
  sourceX,
  sourceY,
  targetX,
  targetY,
}: EdgeProps<MoneyMapCanvasEdge>) {
  if (!data) return null;
  const { flow, handlers, editing = false } = data;
  const geometry = relationshipGeometry(
    flow.route,
    { x: sourceX, y: sourceY },
    { x: targetX, y: targetY },
    flow.waypoints,
  );
  let pointerStart: Point | null = null;
  let pointerDragged = false;
  let suppressClick = false;

  const onPointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    pointerStart = { x: event.clientX, y: event.clientY };
    pointerDragged = false;
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (!pointerStart) return;
    if (pointerMovedBeyondThreshold(pointerStart, { x: event.clientX, y: event.clientY })) {
      pointerDragged = true;
    }
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (pointerStart && pointerDragged) {
      suppressClick = true;
      handlers?.select();
      handlers?.moveWaypoint({ x: event.clientX, y: event.clientY });
    }
    pointerStart = null;
    pointerDragged = false;
  };

  const ariaLabel = `${flow.relationship} relationship from ${flow.source} to ${flow.target}: ${flow.label}; ${flow.cadence.label}`;
  return (
    <>
      <g
        onClick={(event) => {
          event.stopPropagation();
          handlers?.select();
        }}
      >
        <BaseEdge
          className={`money-map-relationship-path relationship--${flow.relationship}`}
          interactionWidth={28}
          markerEnd={flow.relationship === "association" ? undefined : markerEnd}
          path={geometry.path}
        />
      </g>
      <EdgeLabelRenderer>
        <div
          className="money-map-flow-label-wrap nodrag nopan"
          data-flow-label-id={flow.id}
          data-treatment={flow.labelTreatment}
          data-selected={selected ? "true" : "false"}
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${geometry.label.x}px, ${geometry.label.y}px)`,
            pointerEvents: "all",
          }}
        >
          {editing ? (
            <InlineField
              ariaLabel="Edit relationship label"
              value={flow.label}
              onCancel={() => handlers?.cancelEdit()}
              onCommit={(literal) => handlers?.commitEdit(literal)}
            />
          ) : (
            <button
              aria-label={ariaLabel}
              className="money-map-flow-label"
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                if (suppressClick) {
                  suppressClick = false;
                  return;
                }
                handlers?.select();
                handlers?.beginEdit();
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.stopPropagation();
                  event.preventDefault();
                  handlers?.select();
                  handlers?.beginEdit();
                  return;
                }
                if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) {
                  return;
                }
                event.stopPropagation();
                event.preventDefault();
                const distance = event.shiftKey ? 32 : 8;
                handlers?.select();
                const delta =
                  event.key === "ArrowLeft"
                    ? { x: -distance, y: 0 }
                    : event.key === "ArrowRight"
                      ? { x: distance, y: 0 }
                      : event.key === "ArrowUp"
                        ? { x: 0, y: -distance }
                        : { x: 0, y: distance };
                handlers?.nudgeWaypoint({
                  x: geometry.label.x + delta.x,
                  y: geometry.label.y + delta.y,
                });
              }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
            >
              <strong>{flow.label}</strong>
              {flow.secondaryLabel ? <span>{flow.secondaryLabel}</span> : null}
              <small>{flow.cadence.label}</small>
            </button>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
