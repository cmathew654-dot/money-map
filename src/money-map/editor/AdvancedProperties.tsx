import { useRef, useState, type CSSProperties, type KeyboardEvent } from "react";

import type { MoneyMapDocument } from "../model/types";

export type PropertyField =
  | { field: "title" | "eyebrow" | "subtitle" | "note" }
  | { field: "row-label" | "row-value"; rowId: string }
  | { field: "total-label" | "total-value" };

type PropertiesTab = "content" | "appearance" | "connections";

interface AdvancedPropertiesProps {
  document: MoneyMapDocument;
  moduleId: string;
  initialTab: PropertiesTab;
  onCommitField(field: PropertyField, value: string): void;
  onExecute(id: string): void;
  onClose(): void;
  style?: CSSProperties;
}

const tabs: Array<{ id: PropertiesTab; label: string }> = [
  { id: "content", label: "Content" },
  { id: "appearance", label: "Appearance" },
  { id: "connections", label: "Connections" },
];

function PropertyInput({
  label,
  value,
  multiline = false,
  onCommit,
}: {
  label: string;
  value: string;
  multiline?: boolean;
  onCommit(value: string): void;
}) {
  const [draft, setDraft] = useState(value);
  const control = {
    "aria-label": label,
    value: draft,
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setDraft(event.currentTarget.value),
    onBlur: () => onCommit(draft),
    onKeyDown: (event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      event.stopPropagation();
      if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
        event.preventDefault();
        onCommit(draft);
      } else if (event.key === "Escape") {
        event.preventDefault();
        setDraft(value);
      }
    },
  };
  return (
    <label>
      <span>{label}</span>
      {multiline ? <textarea {...control} rows={3} /> : <input {...control} type="text" />}
    </label>
  );
}

export function AdvancedProperties({
  document,
  moduleId,
  initialTab,
  onCommitField,
  onExecute,
  onClose,
  style,
}: AdvancedPropertiesProps) {
  const [tab, setTab] = useState<PropertiesTab>(initialTab);
  const [connectionHelp, setConnectionHelp] = useState(false);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const module = document.modules.find(({ id }) => id === moduleId);
  if (!module) return null;

  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault();
    const next = (index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
    tabRefs.current[next]?.focus();
    setTab(tabs[next].id);
  };

  const relationships = document.flows.filter(
    ({ source, target }) => source === moduleId || target === moduleId,
  );

  return (
    <aside aria-label="Advanced properties" className="advanced-properties" style={style}>
      <header>
        <div>
          <p className="workspace-kicker">Module properties</p>
          <h2>{module.title}</h2>
        </div>
        <button aria-label="Close properties" type="button" onClick={onClose}>
          Close
        </button>
      </header>
      <div aria-label="Property sections" role="tablist">
        {tabs.map((candidate, index) => (
          <button
            aria-controls={`properties-${candidate.id}`}
            aria-selected={tab === candidate.id}
            id={`properties-tab-${candidate.id}`}
            key={candidate.id}
            onClick={() => setTab(candidate.id)}
            onKeyDown={(event) => handleTabKeyDown(event, index)}
            ref={(element) => {
              tabRefs.current[index] = element;
            }}
            role="tab"
            tabIndex={tab === candidate.id ? 0 : -1}
            type="button"
          >
            {candidate.label}
          </button>
        ))}
      </div>

      {tab === "content" ? (
        <div aria-labelledby="properties-tab-content" id="properties-content" role="tabpanel">
          <PropertyInput
            label="Title"
            value={module.title}
            onCommit={(value) => onCommitField({ field: "title" }, value)}
          />
          <details>
            <summary>Supporting fields and narrative</summary>
            <div className="property-fields">
              <PropertyInput
                label="Eyebrow"
                value={module.eyebrow}
                onCommit={(value) => onCommitField({ field: "eyebrow" }, value)}
              />
              <PropertyInput
                label="Subtitle"
                value={module.subtitle ?? ""}
                onCommit={(value) => onCommitField({ field: "subtitle" }, value)}
              />
              {module.rows.map((row) => (
                <div className="property-row" key={row.id}>
                  <PropertyInput
                    label={`${row.label} label`}
                    value={row.label}
                    onCommit={(value) =>
                      onCommitField({ field: "row-label", rowId: row.id }, value)
                    }
                  />
                  <PropertyInput
                    label={`${row.label} value`}
                    value={row.value}
                    onCommit={(value) =>
                      onCommitField({ field: "row-value", rowId: row.id }, value)
                    }
                  />
                </div>
              ))}
              {module.total ? (
                <div className="property-row">
                  <PropertyInput
                    label="Total label"
                    value={module.total.label}
                    onCommit={(value) => onCommitField({ field: "total-label" }, value)}
                  />
                  <PropertyInput
                    label="Total value"
                    value={module.total.value}
                    onCommit={(value) => onCommitField({ field: "total-value" }, value)}
                  />
                </div>
              ) : null}
              <PropertyInput
                label="Narrative"
                multiline
                value={module.note ?? ""}
                onCommit={(value) => onCommitField({ field: "note" }, value)}
              />
            </div>
          </details>
        </div>
      ) : null}

      {tab === "appearance" ? (
        <div aria-labelledby="properties-tab-appearance" id="properties-appearance" role="tabpanel">
          <fieldset>
            <legend>Primitive</legend>
            {["ledger", "plate", "tray", "band", "roundel", "frame"].map((primitive) => (
              <button
                aria-pressed={module.primitive === primitive}
                key={primitive}
                onClick={() => onExecute(`module.primitive.${primitive}`)}
                type="button"
              >
                {primitive}
              </button>
            ))}
          </fieldset>
          <fieldset>
            <legend>Width</legend>
            {[
              ["Small 240", "module.width.small"],
              ["Standard 320", "module.width.standard"],
              ["Wide 400", "module.width.wide"],
            ].map(([label, id]) => (
              <button key={id} onClick={() => onExecute(id)} type="button">
                {label}
              </button>
            ))}
          </fieldset>
        </div>
      ) : null}

      {tab === "connections" ? (
        <div
          aria-labelledby="properties-tab-connections"
          id="properties-connections"
          role="tabpanel"
        >
          <ul>
            {relationships.map((flow) => (
              <li key={flow.id}>{flow.label}</li>
            ))}
          </ul>
          <button type="button" onClick={() => setConnectionHelp(true)}>
            Add connection
          </button>
          {connectionHelp ? (
            <p role="status">
              Connection editing arrives in the next step. No relationship has been saved.
            </p>
          ) : null}
        </div>
      ) : null}
    </aside>
  );
}
