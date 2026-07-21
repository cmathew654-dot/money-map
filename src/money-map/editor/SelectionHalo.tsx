import { useLayoutEffect, useRef } from "react";

import type { CommandDefinition } from "../commands/types";
import type { WorkspaceCommandContext, WorkspaceCommandResult } from "./commands";
import { horizontalViewportShift } from "./surfacePosition";
import { useToolbarNavigation } from "./useToolbarNavigation";

interface SelectionHaloProps {
  selectionCount: number;
  commands: CommandDefinition<WorkspaceCommandContext, WorkspaceCommandResult>[];
  onExecute(id: string): void;
}

const singleCommandOrder = [
  "module.edit",
  "module.style",
  "module.draw-flow",
  "selection.duplicate",
  "module.properties",
];
// A single selected flow: just the two doorways into surfaces that already
// exist (inline label editor, relationship properties). Route, kind, and
// cadence edits live inside the properties surface, not here.
const flowCommandOrder = ["flow.edit", "flow.properties"];
const groupCommandOrder = [
  "selection.duplicate",
  "selection.remove",
  "module.width.small",
  "module.width.standard",
  "module.width.wide",
];

function projectCommands(
  commands: SelectionHaloProps["commands"],
  selectionCount: number,
): SelectionHaloProps["commands"] {
  const byId = new Map(commands.map((command) => [command.id, command]));
  // Flow and module commands are mutually exclusive by availability
  // (hasSingleFlow vs hasSingleModule), so the presence of a flow command
  // is what distinguishes a single selected relationship from a shape.
  const order =
    selectionCount !== 1
      ? groupCommandOrder
      : byId.has("flow.edit") || byId.has("flow.properties")
        ? flowCommandOrder
        : singleCommandOrder;
  return order.flatMap((id) => {
    const command = byId.get(id);
    return command ? [command] : [];
  });
}

export function SelectionHalo({ selectionCount, commands, onExecute }: SelectionHaloProps) {
  const projectedCommands = projectCommands(commands, selectionCount);
  const toolbar = useToolbarNavigation(projectedCommands.length);
  const haloRef = useRef<HTMLDivElement | null>(null);

  // React Flow's node toolbar centers the halo on the selected module with no
  // viewport awareness, so a module against the canvas's left edge pushes the
  // halo's first commands off-screen. Correct against the measured box — the
  // same measured-not-declared discipline as the properties surface in
  // MoneyMapWorkspace — and re-correct whenever the toolbar wrapper is
  // re-anchored: pans, zooms, and node drags all rewrite its inline transform,
  // so observing that style attribute sees every move without subscribing
  // every node to the camera. The corrective transform is written to the DOM
  // synchronously (not through state) so the measured box and the applied
  // shift can never disagree mid-drag: an async commit left a stale shift
  // whenever a new anchor move landed while the previous one was still
  // rendering. The clamp bounds are the intersection of every overflow-
  // clipping ancestor with the viewport, not the viewport alone: the halo is
  // portalled inside the React Flow root, whose overflow: hidden stops
  // painting at the canvas's safe-area padding — a box that measures
  // on-viewport can still have its first buttons cropped at that edge.
  useLayoutEffect(() => {
    const halo = haloRef.current;
    if (!halo) return;
    halo.style.transform = "";
    let applied = 0;
    const reclamp = () => {
      let boundsLeft = 0;
      let boundsRight = window.innerWidth;
      for (let ancestor = halo.parentElement; ancestor; ancestor = ancestor.parentElement) {
        if (getComputedStyle(ancestor).overflowX === "visible") continue;
        const clip = ancestor.getBoundingClientRect();
        boundsLeft = Math.max(boundsLeft, clip.left);
        boundsRight = Math.min(boundsRight, clip.right);
      }
      const box = halo.getBoundingClientRect();
      // The clamp is translation-invariant, so bounds-relative coordinates
      // reuse the viewport-width form unchanged.
      const shift = horizontalViewportShift(
        {
          left: box.left - applied - boundsLeft,
          right: box.right - applied - boundsLeft,
        },
        boundsRight - boundsLeft,
      );
      if (shift === applied) return;
      halo.style.transform = shift === 0 ? "" : `translateX(${shift}px)`;
      applied = shift;
    };
    reclamp();
    const anchor = halo.closest(".selection-halo-anchor");
    if (!anchor) return;
    const observer = new MutationObserver(reclamp);
    observer.observe(anchor, { attributes: true, attributeFilter: ["style"] });
    return () => observer.disconnect();
    // Re-measure when the command set changes: the projected buttons are the
    // halo's entire width.
  }, [projectedCommands.length]);

  if (selectionCount < 1 || projectedCommands.length === 0) return null;
  const label =
    selectionCount !== 1
      ? `${selectionCount} selected items`
      : projectedCommands[0].id.startsWith("flow.")
        ? "Selected relationship actions"
        : "Selected shape actions";

  return (
    <div
      className="selection-halo"
      ref={haloRef}
      role="toolbar"
      aria-label={label}
      onKeyDown={toolbar.onKeyDown}
    >
      {projectedCommands.map((command, index) => (
        <button
          {...toolbar.itemProps(index)}
          key={command.id}
          type="button"
          onClick={() => onExecute(command.id)}
        >
          {command.label}
        </button>
      ))}
    </div>
  );
}
