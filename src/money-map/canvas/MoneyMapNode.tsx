import { memo } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";

import type { MoneyMapNodeData } from "./adapters";

export type MoneyMapCanvasNode = Node<MoneyMapNodeData>;

const handlePositions = [Position.Top, Position.Right, Position.Bottom, Position.Left];

function MoneyMapNodeComponent({ data, selected }: NodeProps<MoneyMapCanvasNode>) {
  const { module, outgoingCount } = data;

  return (
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
        <h2>{module.title}</h2>
        {module.subtitle ? <p className="money-map-module__subtitle">{module.subtitle}</p> : null}
      </header>

      {module.rows.length > 0 ? (
        <dl className="money-map-module__rows">
          {module.rows.map((row) => (
            <div className="money-map-module__row" key={row.id}>
              <dt>{row.label}</dt>
              <dd>{row.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {module.total ? (
        <dl className="money-map-module__total">
          <div>
            <dt>{module.total.label}</dt>
            <dd>{module.total.value}</dd>
          </div>
        </dl>
      ) : null}

      {module.note ? <p className="money-map-module__note">{module.note}</p> : null}
    </article>
  );
}

export const MoneyMapNode = memo(MoneyMapNodeComponent);
