import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";

import { MoneyMapCanvas } from "../canvas/MoneyMapCanvas";
import type { MoneyMapDocument, Selection } from "../model/types";
import { getCanvasTheme } from "../themes/registry";

interface PresentationShellProps {
  document: MoneyMapDocument;
  onExit(): void;
}

const emptySelection: Selection = { moduleIds: [], flowIds: [] };

export function PresentationShell({ document, onExit }: PresentationShellProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const shellRef = useRef<HTMLElement>(null);
  const lastIndex = document.presentation.length - 1;
  const activeStep = document.presentation[activeIndex];
  const theme = getCanvasTheme(document.style);
  const showStep = useCallback(
    (index: number) => setActiveIndex(Math.min(lastIndex, Math.max(0, index))),
    [lastIndex],
  );

  useEffect(() => shellRef.current?.focus(), []);

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === "Escape") {
      event.preventDefault();
      onExit();
      return;
    }
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      showStep(activeIndex - 1);
      return;
    }
    const interactiveTarget =
      event.target instanceof HTMLElement && Boolean(event.target.closest("button, a"));
    if (
      event.key === "ArrowRight" ||
      (!interactiveTarget && (event.key === " " || event.code === "Space"))
    ) {
      event.preventDefault();
      showStep(activeIndex + 1);
    }
  };

  return (
    <main
      aria-label={`${document.title} presentation`}
      className={`money-map-presentation ${theme.className}`}
      onKeyDown={handleKeyDown}
      ref={shellRef}
      tabIndex={-1}
    >
      <header className="presentation-header presentation-chrome">
        <div className="presentation-title">
          <span className="brand-mark" aria-hidden="true">
            C
          </span>
          <div>
            <p className="workspace-kicker">Cairn</p>
            <h1>{document.title}</h1>
          </div>
        </div>
        <div className="presentation-meta">
          <span>{document.asOf}</span>
          <span>{"Synthetic demo \u00b7 advisor-entered values"}</span>
        </div>
        <button className="presentation-exit" type="button" onClick={onExit}>
          Exit presentation
        </button>
      </header>

      <section className="presentation-stage" aria-label={`${document.title} map`}>
        <MoneyMapCanvas
          document={document}
          mode="presentation"
          onDocumentChange={() => undefined}
          onSelectionChange={() => undefined}
          presentationStep={activeStep}
          selection={emptySelection}
        />
      </section>

      <nav className="presentation-nav presentation-chrome" aria-label="Presentation steps">
        <button
          aria-current={activeIndex === 0 ? "step" : undefined}
          className="presentation-overview"
          type="button"
          onClick={() => showStep(0)}
        >
          Overview
        </button>
        <div className="presentation-step-copy" aria-hidden="true">
          <strong className="presentation-current-name">{activeStep.title}</strong>
          <span>{activeIndex === 0 ? "Overview" : `Step ${activeIndex} of ${lastIndex}`}</span>
        </div>
        <div className="presentation-dots">
          {document.presentation.slice(1).map((step, index) => {
            const stepIndex = index + 1;
            return (
              <button
                aria-current={activeIndex === stepIndex ? "step" : undefined}
                aria-label={`Go to ${step.title}`}
                key={step.id}
                type="button"
                onClick={() => showStep(stepIndex)}
              />
            );
          })}
        </div>
      </nav>

      <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {activeIndex === 0
          ? "Overview."
          : `${activeStep.title}, step ${activeIndex} of ${lastIndex}.`}
      </p>
    </main>
  );
}
