import { useEffect, useRef, useState } from "react";

import { MoneyMapCanvas } from "../canvas/MoneyMapCanvas";
import type { MoneyMapDocument, Selection, StarterId } from "../model/types";
import { getScaffoldDocument } from "../starters/scaffolds";

interface MoneyMapWorkspaceProps {
  starterId: StarterId;
  onBack(): void;
}

interface Dimensions {
  width: number;
  height: number;
}

const authoringMinimum = { width: 1180, height: 660 };
const emptySelection: Selection = { moduleIds: [], flowIds: [] };

export function isAuthoringViewportSupported(width: number, height: number): boolean {
  return width >= authoringMinimum.width && height >= authoringMinimum.height;
}

function initialDimensions(): Dimensions {
  if (typeof window === "undefined") return authoringMinimum;
  return { width: window.innerWidth, height: window.innerHeight };
}

function useWorkspaceDimensions() {
  const ref = useRef<HTMLElement>(null);
  const [dimensions, setDimensions] = useState<Dimensions>(initialDimensions);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const measure = () => {
      const bounds = element.getBoundingClientRect();
      if (bounds.width > 0 && bounds.height > 0) {
        setDimensions({ width: bounds.width, height: bounds.height });
      } else {
        setDimensions(initialDimensions());
      }
    };

    measure();
    window.addEventListener("resize", measure);
    if (typeof ResizeObserver === "undefined") {
      return () => window.removeEventListener("resize", measure);
    }

    const observer = new ResizeObserver(([entry]) => {
      setDimensions({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  return { ref, dimensions };
}

export function MoneyMapWorkspace({ starterId, onBack }: MoneyMapWorkspaceProps) {
  const [document, setDocument] = useState<MoneyMapDocument>(() => getScaffoldDocument(starterId));
  const [selection, setSelection] = useState<Selection>(emptySelection);
  const { ref, dimensions } = useWorkspaceDimensions();
  const supported = isAuthoringViewportSupported(dimensions.width, dimensions.height);

  return (
    <main className="money-map-workspace" ref={ref}>
      <header className="workspace-header">
        <button className="text-button" type="button" onClick={onBack}>
          Back to stories
        </button>
        <div className="workspace-heading">
          <span className="brand-mark" aria-hidden="true">
            C
          </span>
          <div>
            <p className="workspace-kicker">Cairn</p>
            <h1>{document.title}</h1>
          </div>
        </div>
        <div className="workspace-meta">
          <span>{document.asOf}</span>
          <span>Synthetic demo · advisor-entered values</span>
        </div>
      </header>

      {supported ? (
        <section className="workspace-stage" aria-label={`${document.title} canvas`}>
          <MoneyMapCanvas
            document={document}
            selection={selection}
            onSelectionChange={setSelection}
            onDocumentChange={setDocument}
          />
        </section>
      ) : (
        <section className="authoring-cover" aria-labelledby="authoring-cover-title">
          <div>
            <p className="workspace-kicker">Authoring canvas</p>
            <h2 id="authoring-cover-title">A larger canvas is required</h2>
            <p>
              Money Map authoring is designed for viewports at least 1180 by 660. Expand this window
              to continue without compressing the financial story.
            </p>
          </div>
        </section>
      )}
    </main>
  );
}
