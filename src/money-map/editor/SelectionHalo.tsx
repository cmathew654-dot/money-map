import type { CommandDefinition } from "../commands/types";
import type { WorkspaceCommandContext, WorkspaceCommandResult } from "./commands";
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
  const order = selectionCount === 1 ? singleCommandOrder : groupCommandOrder;
  return order.flatMap((id) => {
    const command = byId.get(id);
    return command ? [command] : [];
  });
}

export function SelectionHalo({ selectionCount, commands, onExecute }: SelectionHaloProps) {
  const projectedCommands = projectCommands(commands, selectionCount);
  const toolbar = useToolbarNavigation(projectedCommands.length);
  if (selectionCount < 1 || projectedCommands.length === 0) return null;
  const label =
    selectionCount === 1 ? "Selected shape actions" : `${selectionCount} selected items`;

  return (
    <div className="selection-halo" role="toolbar" aria-label={label} onKeyDown={toolbar.onKeyDown}>
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
