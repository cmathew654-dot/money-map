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

export function CommandPalette({
  registry,
  context,
  invoker,
  onExecute,
  onClose,
}: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const commands = useMemo(() => registry.search(query, context), [context, query, registry]);

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

  const executeActive = () => {
    const command = commands[activeIndex];
    if (command) onExecute(command.id);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => (commands.length === 0 ? 0 : (index + 1) % commands.length));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) =>
        commands.length === 0 ? 0 : (index - 1 + commands.length) % commands.length,
      );
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
        role="dialog"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <label htmlFor={`${listId}-search`}>Search actions</label>
        <input
          aria-activedescendant={commands[activeIndex] ? `${listId}-${activeIndex}` : undefined}
          aria-controls={listId}
          aria-label="Search actions"
          autoComplete="off"
          id={`${listId}-search`}
          onChange={(event) => setQuery(event.currentTarget.value)}
          onKeyDown={handleKeyDown}
          ref={inputRef}
          role="combobox"
          value={query}
        />
        <div aria-label="Available actions" id={listId} role="listbox">
          {commands.map((command, index) => (
            <button
              aria-selected={index === activeIndex}
              id={`${listId}-${index}`}
              key={command.id}
              onClick={() => onExecute(command.id)}
              onMouseEnter={() => setActiveIndex(index)}
              role="option"
              type="button"
            >
              <span>{command.label}</span>
              {command.shortcut ? <kbd>{command.shortcut}</kbd> : null}
            </button>
          ))}
          {commands.length === 0 ? <p>No available actions match.</p> : null}
        </div>
      </section>
    </div>
  );
}
