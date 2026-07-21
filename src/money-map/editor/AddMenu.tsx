import { useEffect, useRef, type CSSProperties } from "react";

import type { PrimitiveStyle } from "../model/types";

interface AddMenuProps {
  onChoose(primitive: PrimitiveStyle): void;
  onClose(): void;
  style?: CSSProperties;
}

const choices: Array<{ id: PrimitiveStyle; label: string; description: string }> = [
  { id: "ledger", label: "Ledger", description: "Stacked rows — often recurring income" },
  { id: "plate", label: "Plate", description: "Solid panel — often accounts and portfolios" },
  { id: "tray", label: "Tray", description: "Shallow tray — often short-term reserves" },
  { id: "band", label: "Band", description: "Slim band — often contracts and specialty assets" },
  { id: "roundel", label: "Roundel", description: "Ringed target — often goals and needs" },
  { id: "frame", label: "Frame", description: "Open frame — often advisor context" },
  { id: "cylinder", label: "Cylinder", description: "Reservoir column — often portfolio balances" },
  { id: "text", label: "Text note", description: "Free-form annotation" },
];

export function AddMenu({ onChoose, onClose, style }: AddMenuProps) {
  const first = useRef<HTMLButtonElement>(null);
  useEffect(() => first.current?.focus(), []);

  return (
    <aside
      aria-label="Add to money map"
      className="add-menu"
      onKeyDown={(event) => {
        if (event.key !== "Escape" || event.nativeEvent.isComposing) return;
        event.preventDefault();
        onClose();
      }}
      style={style}
    >
      <header>
        <div>
          <p className="workspace-kicker">Add to map</p>
          <strong>Choose a shape</strong>
        </div>
        <button aria-label="Close Add menu" type="button" onClick={onClose}>
          Close
        </button>
      </header>
      <div className="add-menu__grid">
        {choices.map((choice, index) => (
          <button
            key={choice.id}
            onClick={() => onChoose(choice.id)}
            ref={index === 0 ? first : undefined}
            type="button"
          >
            <span aria-hidden="true" className="add-menu__shape" data-primitive={choice.id} />
            <span>
              <strong>{choice.label}</strong>
              <small>{choice.description}</small>
            </span>
          </button>
        ))}
      </div>
    </aside>
  );
}
