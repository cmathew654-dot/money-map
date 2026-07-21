import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";

import type { CommandRegistry } from "../commands/registry";
import type { WorkspaceCommandContext, WorkspaceCommandResult } from "./commands";

interface CommandPaletteProps {
  registry: CommandRegistry<WorkspaceCommandContext, WorkspaceCommandResult>;
  context: WorkspaceCommandContext;
  invoker: HTMLElement | null;
  onExecute(id: string): void;
  onClose(): void;
}

const focusableSelector =
  'button:not([disabled]):not([tabindex="-1"]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';

// Commands are grouped by what they act on, derived from the stable id prefix each
// command already carries (e.g. "module.width.small" acts on a module). Known prefixes
// get a friendly label and a deliberate order; any prefix this palette has never seen
// before (new command families registered elsewhere, e.g. future camera.* commands)
// still gets its own titled group instead of vanishing or crashing into "Modules".
const KNOWN_GROUP_LABELS: Record<string, string> = {
  workspace: "Story",
  document: "Story",
  module: "Shapes",
  flow: "Relationships",
  selection: "Selection",
  history: "History",
};

const GROUP_ORDER = ["Story", "Shapes", "Relationships", "Selection", "History"];

function groupLabelForId(id: string): string {
  const prefix = id.split(".")[0] ?? "";
  const known = KNOWN_GROUP_LABELS[prefix];
  if (known) return known;
  return prefix ? `${prefix[0].toLocaleUpperCase()}${prefix.slice(1)}` : "More";
}

function groupCommands<Command extends { id: string }>(
  commands: Command[],
): Array<{ label: string; items: Command[] }> {
  const byLabel = new Map<string, Command[]>();
  for (const command of commands) {
    const label = groupLabelForId(command.id);
    const existing = byLabel.get(label);
    if (existing) existing.push(command);
    else byLabel.set(label, [command]);
  }
  const orderedLabels = [
    ...GROUP_ORDER.filter((label) => byLabel.has(label)),
    ...[...byLabel.keys()].filter((label) => !GROUP_ORDER.includes(label)),
  ];
  return orderedLabels.map((label) => ({ label, items: byLabel.get(label)! }));
}

export function CommandPalette({
  registry,
  context,
  invoker,
  onExecute,
  onClose,
}: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const dialogRef = useRef<HTMLElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const commands = useMemo(() => registry.search(query, context), [context, query, registry]);
  const groups = useMemo(() => groupCommands(commands), [commands]);
  const orderedCommands = useMemo(() => groups.flatMap((group) => group.items), [groups]);
  const indexById = useMemo(
    () => new Map(orderedCommands.map((command, index) => [command.id, index])),
    [orderedCommands],
  );

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  const close = () => {
    onClose();
    invoker?.focus();
  };

  const execute = (id: string) => {
    onExecute(id);
    close();
  };

  const executeActive = () => {
    const command = orderedCommands[activeIndex];
    if (command) execute(command.id);
  };

  const handleDialogKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close();
      return;
    }
    if (event.key !== "Tab") return;

    const controls = Array.from(
      dialogRef.current?.querySelectorAll<HTMLElement>(focusableSelector) ?? [],
    );
    if (controls.length === 0) return;
    const currentIndex = controls.indexOf(document.activeElement as HTMLElement);
    const nextIndex = event.shiftKey
      ? currentIndex <= 0
        ? controls.length - 1
        : currentIndex - 1
      : currentIndex === -1 || currentIndex === controls.length - 1
        ? 0
        : currentIndex + 1;
    event.preventDefault();
    controls[nextIndex]?.focus();
  };

  const handleSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    const count = orderedCommands.length;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => (count === 0 ? 0 : (index + 1) % count));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => (count === 0 ? 0 : (index - 1 + count) % count));
    } else if (event.key === "Enter") {
      event.preventDefault();
      executeActive();
    }
  };

  return (
    <div className="command-palette-backdrop" role="presentation" onMouseDown={close}>
      <section
        aria-label="Actions"
        aria-modal="true"
        className="command-palette"
        ref={dialogRef}
        role="dialog"
        onKeyDownCapture={handleDialogKeyDown}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button aria-label="Close actions" type="button" onClick={close}>
          Close
        </button>
        <label htmlFor={`${listId}-search`}>Search actions</label>
        <input
          aria-activedescendant={
            orderedCommands[activeIndex] ? `${listId}-${activeIndex}` : undefined
          }
          aria-autocomplete="list"
          aria-controls={listId}
          aria-expanded="true"
          aria-label="Search actions"
          autoComplete="off"
          id={`${listId}-search`}
          onChange={(event) => setQuery(event.currentTarget.value)}
          onKeyDown={handleSearchKeyDown}
          ref={inputRef}
          role="combobox"
          value={query}
        />
        <div aria-label="Available actions" id={listId} role="listbox">
          {groups.map((group) => {
            const headingId = `${listId}-group-${group.label}`;
            return (
              <div
                className="command-palette__group"
                key={group.label}
                role="group"
                aria-labelledby={headingId}
              >
                <p className="command-palette__group-label" id={headingId} role="presentation">
                  {group.label}
                </p>
                {group.items.map((command) => {
                  const index = indexById.get(command.id) ?? 0;
                  return (
                    <button
                      aria-selected={index === activeIndex}
                      className={
                        command.id === "document.reset"
                          ? "command-palette__option--destructive"
                          : undefined
                      }
                      id={`${listId}-${index}`}
                      key={command.id}
                      onClick={() => execute(command.id)}
                      onMouseEnter={() => setActiveIndex(index)}
                      role="option"
                      tabIndex={-1}
                      type="button"
                    >
                      <span>{command.label}</span>
                      {command.shortcut ? <kbd>{command.shortcut}</kbd> : null}
                    </button>
                  );
                })}
              </div>
            );
          })}
          {orderedCommands.length === 0 ? <p>No available actions match.</p> : null}
        </div>
      </section>
    </div>
  );
}
