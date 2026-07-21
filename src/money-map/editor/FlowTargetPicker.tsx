import { useEffect, useRef, type CSSProperties, type KeyboardEvent } from "react";

import type { MoneyMapDocument, MoneyMapModule, ModuleKind } from "../model/types";

// Grouped by the module's actual financial kind (`MoneyMapModule.kind`), which is a
// required field present on every module — not by shape primitive. Shape is
// deliberately independent of financial meaning (DESIGN.md), so a heading here must
// describe what a destination financially IS, not what it looks like.
const destinationGroups: Array<{ label: string; kind: ModuleKind }> = [
  { label: "Income", kind: "income" },
  { label: "Accounts", kind: "account" },
  { label: "Reserves", kind: "reserve" },
  { label: "Goals & needs", kind: "need" },
  { label: "Specialty", kind: "specialty" },
  { label: "Charitable", kind: "charitable" },
  { label: "Notes", kind: "note" },
];

function groupTargets(targets: MoneyMapModule[]) {
  return destinationGroups
    .map((group) => ({
      label: group.label,
      members: targets.filter((target) => target.kind === group.kind),
    }))
    .filter((group) => group.members.length > 0);
}

interface FlowTargetPickerProps {
  document: MoneyMapDocument;
  sourceId: string;
  onChoose(targetId: string): void;
  onClose(): void;
  style?: CSSProperties;
}

export function FlowTargetPicker({
  document,
  sourceId,
  onChoose,
  onClose,
  style,
}: FlowTargetPickerProps) {
  const firstTarget = useRef<HTMLButtonElement>(null);
  const source = document.modules.find(({ id }) => id === sourceId);
  const targets = document.modules.filter(({ id }) => id !== sourceId);
  const groups = groupTargets(targets);
  const firstTargetId = groups[0]?.members[0]?.id;

  useEffect(() => {
    firstTarget.current?.focus();
  }, []);

  if (!source) return null;

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== "Escape" || event.nativeEvent.isComposing) return;
    event.preventDefault();
    onClose();
  };

  return (
    <aside
      aria-label="Connect to…"
      className="flow-target-picker"
      onKeyDown={handleKeyDown}
      style={style}
    >
      <header>
        <div>
          <p className="workspace-kicker">Connect from</p>
          <h2>{source.title}</h2>
        </div>
        <button aria-label="Cancel connect" onClick={onClose} type="button">
          Cancel
        </button>
      </header>
      {/* The old copy here offered "drag from any visible port". Ports stopped
          starting connections when connecting became a mode, so it pointed at a
          gesture that silently does nothing. */}
      <p>Choose a destination, or press C to connect by clicking cards.</p>
      <div className="flow-target-picker__targets">
        {groups.map((group) => (
          <div className="flow-target-picker__group" key={group.label}>
            <p className="flow-target-picker__group-label">{group.label}</p>
            {group.members.map((target) => (
              <button
                key={target.id}
                onClick={() => onChoose(target.id)}
                ref={target.id === firstTargetId ? firstTarget : undefined}
                type="button"
              >
                <span>{target.eyebrow}</span>
                <strong>{target.title}</strong>
              </button>
            ))}
          </div>
        ))}
      </div>
    </aside>
  );
}
