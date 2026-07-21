import { useRef, type PointerEvent as ReactPointerEvent } from "react";
import { BaseEdge, EdgeLabelRenderer, type EdgeProps } from "@xyflow/react";

import { InlineField } from "../editor/InlineField";
import { type Point } from "../model/types";
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
  const pointerStart = useRef<Point | null>(null);
  const pointerDragged = useRef(false);
  const suppressClick = useRef(false);
  const routePointerStart = useRef<Point | null>(null);
  const routePointerDragged = useRef(false);
  if (!data) return null;
  const { flow, handlers, editing = false } = data;
  const geometry = relationshipGeometry(
    flow.route,
    { x: sourceX, y: sourceY },
    { x: targetX, y: targetY },
    flow.waypoints,
  );

  const onPointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    pointerStart.current = { x: event.clientX, y: event.clientY };
    pointerDragged.current = false;
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (!pointerStart.current) return;
    if (pointerMovedBeyondThreshold(pointerStart.current, { x: event.clientX, y: event.clientY })) {
      pointerDragged.current = true;
    }
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (pointerStart.current && pointerDragged.current) {
      suppressClick.current = true;
      handlers?.select();
      handlers?.moveLabelPosition({ x: event.clientX, y: event.clientY });
    }
    pointerStart.current = null;
    pointerDragged.current = false;
  };

  const resetPointerGesture = () => {
    pointerStart.current = null;
    pointerDragged.current = false;
  };

  const ariaLabel = `${flow.relationship} relationship from ${flow.source} to ${flow.target}: ${flow.label}; ${flow.cadence.label}`;
  return (
    <>
      <g
        data-flow-id={flow.id}
        data-flow-source={flow.source}
        data-flow-target={flow.target}
        onClick={(event) => {
          event.stopPropagation();
          handlers?.select();
        }}
      >
        <BaseEdge
          className="money-map-relationship-casing"
          interactionWidth={0}
          path={geometry.path}
        />
        <BaseEdge
          className={`money-map-relationship-path relationship--${flow.relationship}`}
          interactionWidth={28}
          markerEnd={markerEnd}
          path={geometry.path}
        />
      </g>
      <EdgeLabelRenderer>
        {selected && !data.presentation ? (
          <button
            aria-label={"Adjust route: " + flow.label}
            className="money-map-route-handle nodrag nopan"
            type="button"
            style={{
              position: "absolute",
              transform:
                "translate(-50%, -50%) translate(" +
                (flow.labelPosition.x + 96) +
                "px, " +
                flow.labelPosition.y +
                "px)",
              pointerEvents: "all",
            }}
            onClick={(event) => {
              event.stopPropagation();
              handlers?.select();
            }}
            onPointerDown={(event) => {
              event.stopPropagation();
              routePointerStart.current = { x: event.clientX, y: event.clientY };
              routePointerDragged.current = false;
              event.currentTarget.setPointerCapture?.(event.pointerId);
            }}
            onPointerMove={(event) => {
              event.stopPropagation();
              if (!routePointerStart.current) return;
              routePointerDragged.current = pointerMovedBeyondThreshold(routePointerStart.current, {
                x: event.clientX,
                y: event.clientY,
              });
            }}
            onPointerUp={(event) => {
              event.stopPropagation();
              if (routePointerStart.current && routePointerDragged.current) {
                handlers?.select();
                handlers?.moveWaypointPosition({ x: event.clientX, y: event.clientY });
              }
              routePointerStart.current = null;
              routePointerDragged.current = false;
            }}
            onPointerCancel={() => {
              routePointerStart.current = null;
              routePointerDragged.current = false;
            }}
            onLostPointerCapture={() => {
              routePointerStart.current = null;
              routePointerDragged.current = false;
            }}
            onKeyDown={(event) => {
              if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) {
                return;
              }
              event.stopPropagation();
              event.preventDefault();
              const distance = event.shiftKey ? 32 : 8;
              const delta =
                event.key === "ArrowLeft"
                  ? { x: -distance, y: 0 }
                  : event.key === "ArrowRight"
                    ? { x: distance, y: 0 }
                    : event.key === "ArrowUp"
                      ? { x: 0, y: -distance }
                      : { x: 0, y: distance };
              handlers?.select();
              handlers?.nudgeWaypointPosition({
                x: geometry.label.x + delta.x,
                y: geometry.label.y + delta.y,
              });
            }}
          />
        ) : null}
        <div
          className="money-map-flow-label-wrap nodrag nopan"
          data-flow-label-id={flow.id}
          data-flow-source={flow.source}
          data-flow-target={flow.target}
          data-treatment={flow.labelTreatment}
          data-selected={selected ? "true" : "false"}
          data-presentation-focus={data.presentationFocus ? "true" : "false"}
          data-presentation-dim={data.presentationDim ? "true" : "false"}
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${flow.labelPosition.x}px, ${flow.labelPosition.y}px)`,
            pointerEvents: "all",
          }}
        >
          {data.presentation ? (
            <span className="money-map-flow-label" role="group" aria-label={ariaLabel}>
              <strong>{flow.label}</strong>
              {flow.secondaryLabel ? <span>{flow.secondaryLabel}</span> : null}
              <small>{flow.cadence.label}</small>
            </span>
          ) : editing ? (
            <InlineField
              ariaLabel="Edit relationship label"
              sizeToContent={false}
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
                if (suppressClick.current) {
                  suppressClick.current = false;
                  return;
                }
                handlers?.select();
              }}
              onDoubleClick={(event) => {
                event.stopPropagation();
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
                handlers?.nudgeLabelPosition({
                  x: flow.labelPosition.x + delta.x,
                  y: flow.labelPosition.y + delta.y,
                });
              }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={resetPointerGesture}
              onLostPointerCapture={resetPointerGesture}
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
