import { useToolbarNavigation } from "../editor/useToolbarNavigation";

export interface CanvasController {
  zoomOut(): void;
  resetZoom(): void;
  zoomIn(): void;
  fitMap(): void;
  fitSelection(): void;
  fitStep?(): void;
}

interface CanvasControlsProps {
  controller: CanvasController;
  zoomPercentage: number;
  /** "author" (default) shows Fit story + Fit selection. "presentation" shows
   * Fit story alone, plus Fit step when the active step has participants. */
  variant?: "author" | "presentation";
  hasStepFocus?: boolean;
}

export function CanvasControls({
  controller,
  zoomPercentage,
  variant = "author",
  hasStepFocus = false,
}: CanvasControlsProps) {
  const showFitStep = variant === "presentation" && hasStepFocus;
  const itemCount = variant === "presentation" ? (showFitStep ? 5 : 4) : 5;
  const toolbar = useToolbarNavigation(itemCount);
  return (
    <div
      className={
        variant === "presentation" ? "canvas-controls presentation-chrome" : "canvas-controls"
      }
      role="toolbar"
      aria-label="Canvas camera"
      onKeyDown={toolbar.onKeyDown}
    >
      <div className="canvas-controls__zoom">
        <button
          {...toolbar.itemProps(0)}
          type="button"
          aria-label="Zoom out"
          onClick={controller.zoomOut}
        >
          <span aria-hidden="true">−</span>
        </button>
        <button
          {...toolbar.itemProps(1)}
          className="canvas-controls__percentage"
          type="button"
          aria-label="Reset zoom to 100%"
          onClick={controller.resetZoom}
        >
          {zoomPercentage}%
        </button>
        <button
          {...toolbar.itemProps(2)}
          type="button"
          aria-label="Zoom in"
          onClick={controller.zoomIn}
        >
          <span aria-hidden="true">+</span>
        </button>
      </div>
      <button
        {...toolbar.itemProps(3)}
        type="button"
        aria-label="Fit story"
        onClick={controller.fitMap}
      >
        Fit story
      </button>
      {variant === "presentation" ? (
        showFitStep ? (
          <button
            {...toolbar.itemProps(4)}
            type="button"
            aria-label="Fit step"
            onClick={controller.fitStep}
          >
            Fit step
          </button>
        ) : null
      ) : (
        <button
          {...toolbar.itemProps(4)}
          type="button"
          aria-label="Fit selection"
          onClick={controller.fitSelection}
        >
          Fit selection
        </button>
      )}
    </div>
  );
}
