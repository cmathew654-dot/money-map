import { useEffect, useRef, type CSSProperties, type KeyboardEvent } from "react";

import type { MoneyMapDocument } from "../model/types";

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
      aria-label="Draw flow"
      className="flow-target-picker"
      onKeyDown={handleKeyDown}
      style={style}
    >
      <header>
        <div>
          <p className="workspace-kicker">Draw flow from</p>
          <h2>{source.title}</h2>
        </div>
        <button aria-label="Cancel draw flow" onClick={onClose} type="button">
          Cancel
        </button>
      </header>
      <p>Choose a destination, or drag from any visible port on the canvas.</p>
      <div className="flow-target-picker__targets">
        {targets.map((target, index) => (
          <button
            key={target.id}
            onClick={() => onChoose(target.id)}
            ref={index === 0 ? firstTarget : undefined}
            type="button"
          >
            <span>{target.eyebrow}</span>
            <strong>{target.title}</strong>
          </button>
        ))}
      </div>
    </aside>
  );
}
