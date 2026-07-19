interface SelectionHaloProps {
  selectionCount: number;
  onExecute(id: string): void;
}

const singleCommands = [
  ["Edit", "module.edit"],
  ["Style", "module.style"],
  ["Connect", "module.connect"],
  ["Duplicate", "selection.duplicate"],
  ["More", "module.properties"],
] as const;

const multiCommands = [
  ["Duplicate", "selection.duplicate"],
  ["Remove", "selection.remove"],
  ["Small width", "module.width.small"],
  ["Standard width", "module.width.standard"],
  ["Wide width", "module.width.wide"],
] as const;

export function SelectionHalo({ selectionCount, onExecute }: SelectionHaloProps) {
  if (selectionCount < 1) return null;
  const commands = selectionCount === 1 ? singleCommands : multiCommands;
  const label =
    selectionCount === 1 ? "Selected module actions" : `${selectionCount} selected modules`;

  return (
    <div className="selection-halo" role="toolbar" aria-label={label}>
      {commands.map(([commandLabel, id]) => (
        <button key={id} type="button" onClick={() => onExecute(id)}>
          {commandLabel}
        </button>
      ))}
    </div>
  );
}
