import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";

import type { MoneyMapDocument } from "../model/types";
import type { WorkspaceCommandDefinition } from "./commands";
import type { FlowField } from "./mutations";

interface RelationshipPropertiesProps {
  document: MoneyMapDocument;
  flowId: string;
  commands: WorkspaceCommandDefinition[];
  onClose(): void;
  onCommitField(field: FlowField, literal: string): void;
  onExecute(id: string): void;
  onReconnect(connection: { source: string; target: string }): void;
  style?: CSSProperties;
}

function ExactInput({
  label,
  value,
  onCommit,
}: {
  label: string;
  value: string;
  onCommit(value: string): void;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const commit = () => onCommit(draft);
  return (
    <label>
      <span>{label}</span>
      <input
        aria-label={label}
        type="text"
        value={draft}
        onBlur={commit}
        onChange={(event) => setDraft(event.currentTarget.value)}
        onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
          event.stopPropagation();
          if (event.key === "Enter" && !event.nativeEvent.isComposing) {
            event.preventDefault();
            commit();
          } else if (event.key === "Escape") {
            event.preventDefault();
            setDraft(value);
          }
        }}
      />
    </label>
  );
}

function commandGroup(commands: WorkspaceCommandDefinition[], prefix: string) {
  return commands.filter(({ id }) => id.startsWith(prefix));
}

export function RelationshipProperties({
  document,
  flowId,
  commands,
  onClose,
  onCommitField,
  onExecute,
  onReconnect,
  style,
}: RelationshipPropertiesProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const flow = document.flows.find(({ id }) => id === flowId);
  useEffect(() => closeRef.current?.focus(), [flowId]);
  if (!flow) return null;

  const renderCommands = (legend: string, prefix: string, activeId?: string) => (
    <fieldset>
      <legend>{legend}</legend>
      {commandGroup(commands, prefix).map((command) => (
        <button
          aria-pressed={command.id === activeId}
          key={command.id}
          onClick={() => onExecute(command.id)}
          type="button"
        >
          {command.label}
        </button>
      ))}
    </fieldset>
  );

  return (
    <aside
      aria-label="Relationship properties"
      className="relationship-properties"
      onKeyDown={(event) => {
        if (event.key !== "Escape" || event.nativeEvent.isComposing) return;
        event.preventDefault();
        onClose();
      }}
      style={style}
    >
      <header>
        <div>
          <p className="workspace-kicker">Relationship</p>
          <h2>{flow.label}</h2>
        </div>
        <button ref={closeRef} type="button" onClick={onClose}>
          Close
        </button>
      </header>
      <ExactInput
        label="Primary label"
        value={flow.label}
        onCommit={(literal) => onCommitField({ field: "label" }, literal)}
      />
      <ExactInput
        label="Secondary label"
        value={flow.secondaryLabel ?? ""}
        onCommit={(literal) => onCommitField({ field: "secondaryLabel" }, literal)}
      />
      <div className="relationship-endpoints">
        <label>
          <span>Source module</span>
          <select
            aria-label="Source module"
            value={flow.source}
            onChange={(event) =>
              onReconnect({ source: event.currentTarget.value, target: flow.target })
            }
          >
            {document.modules
              .filter((module) => module.id !== flow.target)
              .map((module) => (
                <option key={module.id} value={module.id}>
                  {module.title}
                </option>
              ))}
          </select>
        </label>
        <label>
          <span>Target module</span>
          <select
            aria-label="Target module"
            value={flow.target}
            onChange={(event) =>
              onReconnect({ source: flow.source, target: event.currentTarget.value })
            }
          >
            {document.modules
              .filter((module) => module.id !== flow.source)
              .map((module) => (
                <option key={module.id} value={module.id}>
                  {module.title}
                </option>
              ))}
          </select>
        </label>
      </div>
      {renderCommands("Route", "flow.route.", `flow.route.${flow.route}`)}
      {renderCommands(
        "Relationship",
        "flow.relationship.",
        `flow.relationship.${flow.relationship}`,
      )}
      {renderCommands(
        "Label treatment",
        "flow.label-treatment.",
        `flow.label-treatment.${flow.labelTreatment}`,
      )}
      {renderCommands("Cadence", "flow.cadence.", `flow.cadence.${flow.cadence.kind}`)}
      {flow.cadence.kind === "custom" ? (
        <ExactInput
          label="Custom cadence"
          value={flow.cadence.label}
          onCommit={(literal) => onCommitField({ field: "cadence", kind: "custom" }, literal)}
        />
      ) : null}
      {commands
        .filter(({ id }) => id === "flow.label-position.reset")
        .map((command) => (
          <button key={command.id} type="button" onClick={() => onExecute(command.id)}>
            {command.label}
          </button>
        ))}
    </aside>
  );
}
