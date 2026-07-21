import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";

import type { MoneyMapDocument, RelationshipKind } from "../model/types";

interface RelationshipLegendProps {
  document: MoneyMapDocument;
  /** Controlled mode: when supplied, this component stops managing its own open
   * state and hides its persistent toggle. Used by the authoring shell, which
   * invokes the legend from the command palette instead of a standing button —
   * see MoneyMapWorkspace.tsx's "workspace.legend" command. Presentation passes
   * neither prop and keeps the original self-contained toggle+list widget. */
  open?: boolean;
  onClose?(): void;
}

const RELATIONSHIP_ORDER: RelationshipKind[] = ["income", "transfer", "replenishment", "planned"];

// Mirrors the exact stroke treatment MoneyMapEdge.tsx applies via canvas.css's
// .relationship--{kind} classes (canvas.css: .relationship--income/-transfer/
// -replenishment/-planned, ~L1005-1020). Duplicated here as literal values,
// not a shared import, because canvas.css is CSS and owned by a different
// workstream than this component. If those dasharray values ever change,
// update this map in the same change so the legend samples never silently
// drift from what the edges actually render.
const RELATIONSHIP_STROKE: Record<
  RelationshipKind,
  { dasharray?: string; linecap?: "round" | "butt" }
> = {
  income: {},
  transfer: { dasharray: "10 6" },
  replenishment: { dasharray: "2 6", linecap: "round" },
  planned: { dasharray: "12 5 2 5" },
};

// Labels match the vocabulary already used elsewhere (commands.ts registers
// "Income relationship" / "Planned relationship", etc). The description only
// surfaces as a native title tooltip in this compact, single-line form — it's
// a bonus for a mouse-hovering advisor, not load-bearing for comprehension.
const RELATIONSHIP_COPY: Record<RelationshipKind, { label: string; description: string }> = {
  income: { label: "Income", description: "Money arriving from outside the household" },
  transfer: {
    label: "Transfer",
    description: "Money moving between the household's own accounts",
  },
  replenishment: {
    label: "Replenishment",
    description: "A reserve refilling from another source",
  },
  planned: { label: "Planned", description: "Authored but not yet in effect" },
};

export function RelationshipLegend({
  document,
  open: controlledOpen,
  onClose,
}: RelationshipLegendProps) {
  const controlled = controlledOpen !== undefined;
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlled ? controlledOpen : internalOpen;
  const toggleRef = useRef<HTMLButtonElement>(null);
  const listId = useId();

  useEffect(() => {
    if (controlled && open) requestAnimationFrame(() => toggleRef.current?.focus());
  }, [controlled, open]);

  const present = RELATIONSHIP_ORDER.filter((kind) =>
    document.flows.some((flow) => flow.relationship === kind),
  );

  if (present.length === 0) return null;

  const close = () => {
    if (controlled) {
      onClose?.();
      return;
    }
    setInternalOpen(false);
    requestAnimationFrame(() => toggleRef.current?.focus());
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (!open || event.key !== "Escape" || event.nativeEvent.isComposing) return;
    // Stop propagation: in the presentation shell, Escape on the shell itself
    // exits presentation entirely. While the legend is open, Escape should
    // close it first, not both at once.
    event.stopPropagation();
    event.preventDefault();
    close();
  };

  return (
    <div className="relationship-legend" onKeyDown={handleKeyDown}>
      {controlled ? null : (
        <button
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          className="relationship-legend__toggle"
          onClick={() => setInternalOpen((value) => !value)}
          ref={toggleRef}
          type="button"
        >
          Legend
        </button>
      )}
      {open ? (
        <ul aria-label="Relationship legend" className="relationship-legend__list" id={listId}>
          {present.map((kind) => (
            <li key={kind} title={RELATIONSHIP_COPY[kind].description}>
              <svg
                aria-hidden="true"
                className="relationship-legend__sample"
                focusable="false"
                height="10"
                viewBox="0 0 24 10"
                width="24"
              >
                <line
                  x1="1"
                  y1="5"
                  x2="23"
                  y2="5"
                  stroke="var(--map-line)"
                  strokeDasharray={RELATIONSHIP_STROKE[kind].dasharray}
                  strokeLinecap={RELATIONSHIP_STROKE[kind].linecap}
                  strokeWidth="1.7"
                />
              </svg>
              <span>{RELATIONSHIP_COPY[kind].label}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {controlled && open ? (
        <button
          aria-label="Hide legend"
          className="relationship-legend__toggle"
          onClick={close}
          ref={toggleRef}
          type="button"
        >
          Hide legend
        </button>
      ) : null}
    </div>
  );
}
