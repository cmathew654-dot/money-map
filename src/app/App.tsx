import { useState } from "react";

import { MoneyMapWorkspace } from "../money-map/editor/MoneyMapWorkspace";
import type { StarterId } from "../money-map/model/types";
import { getStarterDefinition } from "../money-map/starters/registry";
import { STARTER_IDS } from "../money-map/starters/types";

const starters = STARTER_IDS.map((id) => {
  const definition = getStarterDefinition(id);
  return {
    id,
    title: definition.document.title,
    ...definition.chooser,
  };
});
export function App() {
  const [selected, setSelected] = useState<StarterId | null>(null);

  if (selected) {
    return <MoneyMapWorkspace starterId={selected} onBack={() => setSelected(null)} />;
  }

  return (
    <main className="app-shell">
      <section className="chooser" aria-labelledby="chooser-title">
        <header className="chooser-intro">
          <div className="cairn-lockup">
            <span className="brand-mark" aria-hidden="true">
              C
            </span>
            <span>CAIRN</span>
          </div>
          <h1 id="chooser-title">Choose a story</h1>
          <p className="chooser-lede">
            Start with a composed financial narrative, then shape it around the household in front
            of you.
          </p>
        </header>
        <div className="starter-grid">
          {starters.map((starter) => (
            <button
              className="starter-entry"
              data-accent={starter.accent}
              key={starter.id}
              type="button"
              onClick={() => setSelected(starter.id)}
            >
              <span className="starter-mark" aria-hidden="true">
                <span className="starter-mark-stone starter-mark-stone--base" />
                <span className="starter-mark-stone starter-mark-stone--mid" />
                <span className="starter-mark-stone starter-mark-stone--cap" />
              </span>
              <span className="starter-copy">
                <span className="starter-meta">{starter.eyebrow}</span>
                <strong>{starter.title}</strong>
                <span>{starter.description}</span>
              </span>
              <span className="starter-arrow" aria-hidden="true">
                →
              </span>
            </button>
          ))}
        </div>
        <footer className="chooser-footer">
          <span>Four distinct narratives</span>
          <span>Values are displayed exactly as authored</span>
        </footer>
      </section>
    </main>
  );
}
