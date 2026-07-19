import { memo } from "react";
import {
  Handle,
  NodeResizeControl,
  NodeToolbar,
  Position,
  type Node,
  type NodeProps,
} from "@xyflow/react";

import { InlineField } from "../editor/InlineField";
import { SelectionHalo } from "../editor/SelectionHalo";
import { useEditorInteraction } from "../editor/EditorInteractionContext";
import type { MoneyMapNodeData } from "./adapters";

export type MoneyMapCanvasNode = Node<MoneyMapNodeData>;

const handlePositions = [Position.Top, Position.Right, Position.Bottom, Position.Left];

const singleHaloCommandIds = new Set([
  "module.edit",
  "module.style",
  "module.connect",
  "selection.duplicate",
  "module.properties",
]);
const groupHaloCommandIds = new Set([
  "selection.duplicate",
  "selection.remove",
  "module.width.small",
  "module.width.standard",
  "module.width.wide",
]);

function MoneyMapNodeComponent({ data, selected }: NodeProps<MoneyMapCanvasNode>) {
  const { module, outgoingCount } = data;
  const editor = useEditorInteraction();
  const active = editor?.activeInlineField;
  const haloCommandIds = data.selectionCount === 1 ? singleHaloCommandIds : groupHaloCommandIds;
  const haloCommands = editor?.availableCommands.filter(({ id }) => haloCommandIds.has(id)) ?? [];

  const beginTitle = () =>
    editor?.beginInlineEdit({ moduleId: module.id, field: "title", original: module.title });

  return (
    <>
      {data.haloAnchor && editor ? (
        <NodeToolbar
          className="selection-halo-anchor"
          isVisible
          nodeId={data.selectionModuleIds}
          position={Position.Top}
        >
          <SelectionHalo
            commands={haloCommands}
            selectionCount={data.selectionCount}
            onExecute={editor.executeCommand}
          />
        </NodeToolbar>
      ) : null}

      {selected && editor?.selectionCount === 1 ? (
        <>
          {[Position.Left, Position.Right].map((position) => (
            <NodeResizeControl
              className="money-map-resize-control"
              key={position}
              maxWidth={480}
              minWidth={220}
              onResizeEnd={(_event, parameters) =>
                editor.commitModuleWidth(module.id, parameters.width)
              }
              position={position}
              resizeDirection="horizontal"
            >
              <span aria-hidden="true" />
            </NodeResizeControl>
          ))}
        </>
      ) : null}

      <article
        className="money-map-module"
        data-kind={module.kind}
        data-primitive={module.primitive}
        data-selected={selected ? "true" : "false"}
        aria-label={`${module.title}, ${outgoingCount} outgoing relationships`}
      >
        {handlePositions.map((position) => (
          <Handle
            className="money-map-handle"
            id={`target-${position}`}
            key={`target-${position}`}
            position={position}
            type="target"
            isConnectable={false}
          />
        ))}
        {handlePositions.map((position) => (
          <Handle
            className="money-map-handle"
            id={`source-${position}`}
            key={`source-${position}`}
            position={position}
            type="source"
            isConnectable={false}
          />
        ))}

        <header className="money-map-module__header">
          <p className="money-map-module__eyebrow">{module.eyebrow}</p>
          <h2 onDoubleClick={beginTitle}>
            {active?.moduleId === module.id && active.field === "title" ? (
              <InlineField
                ariaLabel="Edit module title"
                value={active.original}
                onCancel={editor?.cancelInlineEdit ?? (() => undefined)}
                onCommit={editor?.commitInlineEdit ?? (() => undefined)}
              />
            ) : (
              module.title
            )}
          </h2>
          {module.subtitle ? <p className="money-map-module__subtitle">{module.subtitle}</p> : null}
        </header>

        {module.rows.length > 0 ? (
          <dl className="money-map-module__rows">
            {module.rows.map((row) => {
              const editing =
                active?.moduleId === module.id &&
                active.field === "row-value" &&
                active.rowId === row.id;
              return (
                <div className="money-map-module__row" key={row.id}>
                  <dt>{row.label}</dt>
                  <dd
                    onDoubleClick={() =>
                      editor?.beginInlineEdit({
                        moduleId: module.id,
                        field: "row-value",
                        rowId: row.id,
                        original: row.value,
                      })
                    }
                  >
                    {editing ? (
                      <InlineField
                        ariaLabel={`Edit ${row.label} value`}
                        value={active.original}
                        onCancel={editor?.cancelInlineEdit ?? (() => undefined)}
                        onCommit={editor?.commitInlineEdit ?? (() => undefined)}
                      />
                    ) : (
                      row.value
                    )}
                  </dd>
                </div>
              );
            })}
          </dl>
        ) : null}

        {module.total ? (
          <dl className="money-map-module__total">
            <div>
              <dt>{module.total.label}</dt>
              <dd
                onDoubleClick={() =>
                  editor?.beginInlineEdit({
                    moduleId: module.id,
                    field: "total-value",
                    original: module.total?.value ?? "",
                  })
                }
              >
                {active?.moduleId === module.id && active.field === "total-value" ? (
                  <InlineField
                    ariaLabel="Edit total value"
                    value={active.original}
                    onCancel={editor?.cancelInlineEdit ?? (() => undefined)}
                    onCommit={editor?.commitInlineEdit ?? (() => undefined)}
                  />
                ) : (
                  module.total.value
                )}
              </dd>
            </div>
          </dl>
        ) : null}

        {module.note ? <p className="money-map-module__note">{module.note}</p> : null}
      </article>
    </>
  );
}

export const MoneyMapNode = memo(MoneyMapNodeComponent);
