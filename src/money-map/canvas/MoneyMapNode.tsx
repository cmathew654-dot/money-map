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

function MoneyMapNodeComponent({ data, selected }: NodeProps<MoneyMapCanvasNode>) {
  const { module, outgoingCount } = data;
  const editor = useEditorInteraction();
  const active = editor?.activeInlineField;
  const canStartConnection = data.connectMode;
  const canEndConnection = data.connectMode || data.reconnectMode;
  const showDetails = module.density !== "essential";
  const showNote = showDetails;
  const beginTitle = () =>
    editor?.beginInlineEdit({ moduleId: module.id, field: "title", original: module.title });
  const editing = (field: string, rowId?: string) =>
    active?.moduleId === module.id && active.field === field &&
    (!("rowId" in active) || active.rowId === rowId);

  return (
    <>
      {data.haloAnchor && editor && !data.presentation ? (
        <NodeToolbar
          className="selection-halo-anchor"
          isVisible
          nodeId={data.selectionModuleIds}
          position={Position.Top}
        >
          <SelectionHalo
            commands={editor.availableCommands}
            selectionCount={data.selectionCount}
            onExecute={editor.executeCommand}
          />
        </NodeToolbar>
      ) : null}

      {selected && editor?.selectionCount === 1 && !data.presentation ? (
        module.rotation === 0 ? (
          <NodeResizeControl
            className="money-map-resize-control"
            maxHeight={520}
            maxWidth={520}
            minHeight={112}
            minWidth={180}
            onResizeEnd={(_event, parameters) =>
              editor.commitModuleSize(module.id, {
                width: parameters.width,
                height: parameters.height,
              })
            }
          >
            <span aria-hidden="true" />
          </NodeResizeControl>
        ) : null
      ) : null}

      <article
        className="money-map-module"
        data-kind={module.kind}
        data-primitive={module.primitive}
        data-priority={module.priority}
        data-density={module.density}
        data-color-role={module.colorRole}
        data-swatch={module.swatch}
        data-selected={selected ? "true" : "false"}
        data-connect-mode={data.connectMode ? "true" : "false"}
        data-reconnect-mode={data.reconnectMode ? "true" : "false"}
        data-presentation-focus={data.presentationFocus ? "true" : "false"}
        style={{ transform: `rotate(${module.rotation}deg)` }}
        aria-label={`${module.title}, ${outgoingCount} outgoing relationships`}
      >
        {handlePositions.map((position) => (
          <Handle
            className="money-map-handle"
            id={`target-${position}`}
            key={`target-${position}`}
            position={position}
            type="target"
            isConnectable={canEndConnection}
            isConnectableStart={canStartConnection}
            isConnectableEnd={canEndConnection}
          />
        ))}
        {handlePositions.map((position) => (
          <Handle
            className="money-map-handle"
            id={`source-${position}`}
            key={`source-${position}`}
            position={position}
            type="source"
            isConnectable={canEndConnection}
            isConnectableStart={canStartConnection}
            isConnectableEnd={canEndConnection}
          />
        ))}

        <header className="money-map-module__header">
          {showDetails ? (
            <p
              className="money-map-module__eyebrow"
              onDoubleClick={() =>
                editor?.beginInlineEdit({
                  moduleId: module.id,
                  field: "eyebrow",
                  original: module.eyebrow,
                })
              }
            >
              {editing("eyebrow") ? (
                <InlineField
                  ariaLabel="Edit eyebrow"
                  value={active?.original ?? module.eyebrow}
                  onCancel={editor?.cancelInlineEdit ?? (() => undefined)}
                  onCommit={editor?.commitInlineEdit ?? (() => undefined)}
                />
              ) : module.eyebrow}
            </p>
          ) : null}
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
          {showDetails && module.subtitle ? (
            <p
              className="money-map-module__subtitle"
              onDoubleClick={() =>
                editor?.beginInlineEdit({
                  moduleId: module.id,
                  field: "subtitle",
                  original: module.subtitle ?? "",
                })
              }
            >
              {editing("subtitle") ? (
                <InlineField
                  ariaLabel="Edit subtitle"
                  value={active?.original ?? module.subtitle}
                  onCancel={editor?.cancelInlineEdit ?? (() => undefined)}
                  onCommit={editor?.commitInlineEdit ?? (() => undefined)}
                />
              ) : module.subtitle}
            </p>
          ) : null}
        </header>

        {showDetails && module.rows.length > 0 ? (
          <dl className="money-map-module__rows">
            {module.rows.map((row) => {
              const editingValue =
                active?.moduleId === module.id &&
                active.field === "row-value" &&
                active.rowId === row.id;
              return (
                <div className="money-map-module__row" key={row.id}>
                  <dt
                    onDoubleClick={() =>
                      editor?.beginInlineEdit({
                        moduleId: module.id,
                        field: "row-label",
                        rowId: row.id,
                        original: row.label,
                      })
                    }
                  >
                    {editing("row-label", row.id) ? (
                      <InlineField
                        ariaLabel="Edit row label"
                        value={active?.original ?? row.label}
                        onCancel={editor?.cancelInlineEdit ?? (() => undefined)}
                        onCommit={editor?.commitInlineEdit ?? (() => undefined)}
                      />
                    ) : row.label}
                  </dt>
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
                    {editingValue ? (
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
              <dt
                onDoubleClick={() =>
                  editor?.beginInlineEdit({
                    moduleId: module.id,
                    field: "total-label",
                    original: module.total?.label ?? "",
                  })
                }
              >
                {editing("total-label") ? (
                  <InlineField
                    ariaLabel="Edit total label"
                    value={active?.original ?? module.total.label}
                    onCancel={editor?.cancelInlineEdit ?? (() => undefined)}
                    onCommit={editor?.commitInlineEdit ?? (() => undefined)}
                  />
                ) : module.total.label}
              </dt>
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

        {showNote && module.note ? (
          <p
            className="money-map-module__note"
            onDoubleClick={() =>
              editor?.beginInlineEdit({
                moduleId: module.id,
                field: "note",
                original: module.note ?? "",
              })
            }
          >
            {editing("note") ? (
              <InlineField
                ariaLabel="Edit note"
                multiline
                value={active?.original ?? module.note}
                onCancel={editor?.cancelInlineEdit ?? (() => undefined)}
                onCommit={editor?.commitInlineEdit ?? (() => undefined)}
              />
            ) : module.note}
          </p>
        ) : null}
      </article>
    </>
  );
}

export const MoneyMapNode = memo(MoneyMapNodeComponent);
