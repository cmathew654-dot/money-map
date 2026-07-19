import type { CommandDefinition } from "../commands/types";
import type { WorkspaceCommandContext, WorkspaceCommandResult } from "./commands";

interface SelectionHaloProps {
  selectionCount: number;
  commands: CommandDefinition<WorkspaceCommandContext, WorkspaceCommandResult>[];
  onExecute(id: string): void;
}

export function SelectionHalo({ selectionCount, commands, onExecute }: SelectionHaloProps) {
  if (selectionCount < 1 || commands.length === 0) return null;
  const label =
    selectionCount === 1 ? "Selected module actions" : `${selectionCount} selected items`;

  return (
    <div className="selection-halo" role="toolbar" aria-label={label}>
      {commands.map((command) => (
        <button key={command.id} type="button" onClick={() => onExecute(command.id)}>
          {command.label}
        </button>
      ))}
    </div>
  );
}
