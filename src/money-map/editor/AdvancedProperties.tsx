import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";

import type { CommandDefinition } from "../commands/types";
import type { MoneyMapDocument } from "../model/types";
import type { WorkspaceCommandContext, WorkspaceCommandResult } from "./commands";

export type PropertyField =
  | { field: "title" | "eyebrow" | "subtitle" | "note" }
  | { field: "row-label" | "row-value"; rowId: string }
  | { field: "total-label" | "total-value" };

type PropertiesTab = "content" | "appearance" | "connections";
type WorkspaceCommandDefinition = CommandDefinition<
  WorkspaceCommandContext,
  WorkspaceCommandResult
>;

interface AdvancedPropertiesProps {
  commands: WorkspaceCommandDefinition[];
  document: MoneyMapDocument;
  moduleId: string;
  initialTab: PropertiesTab;
  onCommitField(moduleId: string, field: PropertyField, value: string): void;
  onExecute(id: string): void;
  onCreateConnection?(source: string, target: string): void;
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

  useEffect(() => {
    setDraft(value);
  }, [value]);

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
  commands,
  document,
  moduleId,
  initialTab,
  onCommitField,
  onExecute,
  onCreateConnection,
  onClose,
  style,
}: AdvancedPropertiesProps) {
  const [tab, setTab] = useState<PropertiesTab>(initialTab);
  const [connectionTarget, setConnectionTarget] = useState("");
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const module = document.modules.find(({ id }) => id === moduleId);
  const availableTargets = document.modules.filter(({ id }) => id !== moduleId);

  useEffect(() => {
    if (!availableTargets.some(({ id }) => id === connectionTarget)) {
      setConnectionTarget(availableTargets[0]?.id ?? "");
    }
  }, [availableTargets, connectionTarget]);
  const primitiveCommands = commands.filter(({ id }) => id.startsWith("module.primitive."));
  const widthCommands = commands.filter(({ id }) => id.startsWith("module.width."));

  useEffect(() => {
    setTab(initialTab);
    const index = tabs.findIndex(({ id }) => id === initialTab);
    tabRefs.current[index]?.focus();
  }, [initialTab, moduleId]);

  if (!module) return null;

  const commit = (field: PropertyField, value: string) => onCommitField(moduleId, field, value);

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
            onCommit={(value) => commit({ field: "title" }, value)}
          />
          <details>
            <summary>Supporting fields and narrative</summary>
            <div className="property-fields">
              <PropertyInput
                label="Eyebrow"
                value={module.eyebrow}
                onCommit={(value) => commit({ field: "eyebrow" }, value)}
              />
              <PropertyInput
                label="Subtitle"
                value={module.subtitle ?? ""}
                onCommit={(value) => commit({ field: "subtitle" }, value)}
              />
              {module.rows.map((row) => (
                <div className="property-row" key={row.id}>
                  <PropertyInput
                    label={`${row.label} label`}
                    value={row.label}
                    onCommit={(value) => commit({ field: "row-label", rowId: row.id }, value)}
                  />
                  <PropertyInput
                    label={`${row.label} value`}
                    value={row.value}
                    onCommit={(value) => commit({ field: "row-value", rowId: row.id }, value)}
                  />
                </div>
              ))}
              {module.total ? (
                <div className="property-row">
                  <PropertyInput
                    label="Total label"
                    value={module.total.label}
                    onCommit={(value) => commit({ field: "total-label" }, value)}
                  />
                  <PropertyInput
                    label="Total value"
                    value={module.total.value}
                    onCommit={(value) => commit({ field: "total-value" }, value)}
                  />
                </div>
              ) : null}
              <PropertyInput
                label="Narrative"
                multiline
                value={module.note ?? ""}
                onCommit={(value) => commit({ field: "note" }, value)}
              />
            </div>
          </details>
        </div>
      ) : null}

      {tab === "appearance" ? (
        <div aria-labelledby="properties-tab-appearance" id="properties-appearance" role="tabpanel">
          <fieldset>
            <legend>Primitive</legend>
            {primitiveCommands.map((command) => (
              <button
                aria-pressed={command.id === `module.primitive.${module.primitive}`}
                key={command.id}
                onClick={() => onExecute(command.id)}
                type="button"
              >
                {command.label}
              </button>
            ))}
          </fieldset>
          <fieldset>
            <legend>Width</legend>
            {widthCommands.map((command) => (
              <button key={command.id} onClick={() => onExecute(command.id)} type="button">
                {command.label}
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
          <label>
            <span>Connection target</span>
            <select
              aria-label="Connection target"
              value={connectionTarget}
              onChange={(event) => setConnectionTarget(event.currentTarget.value)}
            >
              {availableTargets.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.title}
                </option>
              ))}
            </select>
          </label>
          <button
            disabled={!connectionTarget || !onCreateConnection}
            type="button"
            onClick={() => onCreateConnection?.(moduleId, connectionTarget)}
          >
            Add connection
          </button>
        </div>
      ) : null}
    </aside>
  );
}
