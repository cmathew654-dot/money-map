import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";

import { CanvasControls, type CanvasController } from "../canvas/CanvasControls";
import { MoneyMapCanvas } from "../canvas/MoneyMapCanvas";
import type { MoneyMapDocument, Selection } from "../model/types";
import { getCanvasTheme } from "../themes/registry";
import { RelationshipLegend } from "./RelationshipLegend";

interface PresentationShellProps {
  document: MoneyMapDocument;
  onExit(): void;
}

const emptySelection: Selection = { moduleIds: [], flowIds: [] };

export function PresentationShell({ document, onExit }: PresentationShellProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [controller, setController] = useState<CanvasController | null>(null);
  const [zoomPercentage, setZoomPercentage] = useState(100);
  const shellRef = useRef<HTMLElement>(null);
  const lastIndex = document.presentation.length - 1;
  const activeStep = document.presentation[activeIndex];
  const canvasStep = useMemo(
    () => (activeIndex === 0 ? { ...activeStep, moduleIds: [], flowIds: [] } : activeStep),
    [activeIndex, activeStep],
  );
  const hasStepFocus = canvasStep.moduleIds.length > 0 || canvasStep.flowIds.length > 0;
  const theme = getCanvasTheme(document.style);
  const showStep = useCallback(
    (index: number) => setActiveIndex(Math.min(lastIndex, Math.max(0, index))),
    [lastIndex],
  );

  useEffect(() => shellRef.current?.focus(), []);

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.altKey) return;
    if (event.ctrlKey || event.metaKey) {
      if (event.key === "+" || event.key === "=") {
        event.preventDefault();
        controller?.zoomIn();
      } else if (event.key === "-") {
        event.preventDefault();
        controller?.zoomOut();
      }
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      onExit();
      return;
    }
    // A roving-tabindex toolbar owns its own arrow keys; stepping the story
    // from inside one would move the client-facing view while the presenter
    // is only traversing camera controls.
    const withinToolbar =
      event.target instanceof HTMLElement && Boolean(event.target.closest("[role='toolbar']"));
    if (event.key === "ArrowLeft") {
      if (withinToolbar) return;
      event.preventDefault();
      showStep(activeIndex - 1);
      return;
    }
    const interactiveTarget =
      event.target instanceof HTMLElement && Boolean(event.target.closest("button, a"));
    if (withinToolbar && event.key === "ArrowRight") return;
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
        <div className="presentation-header-actions">
          <RelationshipLegend document={document} />
          <button className="presentation-exit" type="button" onClick={onExit}>
            Exit presentation
          </button>
        </div>
      </header>

      <section className="presentation-stage" aria-label={`${document.title} map`}>
        <MoneyMapCanvas
          document={document}
          mode="presentation"
          onControllerChange={setController}
          onZoomChange={setZoomPercentage}
          onDocumentChange={() => undefined}
          onSelectionChange={() => undefined}
          presentationStep={canvasStep}
          selection={emptySelection}
        />
      </section>

      <nav className="presentation-nav presentation-chrome" aria-label="Presentation steps">
        <ol className="presentation-rail">
          {document.presentation.map((step, index) => (
            <li
              className="presentation-rail__item"
              data-current={activeIndex === index ? "true" : undefined}
              key={step.id}
            >
              <button
                aria-current={activeIndex === index ? "step" : undefined}
                className="presentation-rail__step"
                type="button"
                onClick={() => showStep(index)}
              >
                {step.title}
              </button>
            </li>
          ))}
        </ol>
        {controller ? (
          <CanvasControls
            controller={controller}
            zoomPercentage={zoomPercentage}
            variant="presentation"
            hasStepFocus={hasStepFocus}
          />
        ) : null}
      </nav>

      <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {activeIndex === 0
          ? "Overview."
          : `${activeStep.title}, step ${activeIndex} of ${lastIndex}.`}
      </p>
    </main>
  );
}
