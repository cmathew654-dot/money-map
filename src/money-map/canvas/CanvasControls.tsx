import { useToolbarNavigation } from "../editor/useToolbarNavigation";

export interface CanvasController {
  zoomOut(): void;
  resetZoom(): void;
  zoomIn(): void;
  fitMap(): void;
  fitSelection(): void;
}

interface CanvasControlsProps {
  controller: CanvasController;
  zoomPercentage: number;
}

export function CanvasControls({ controller, zoomPercentage }: CanvasControlsProps) {
  const toolbar = useToolbarNavigation(5);
  return (
    <div
      className="canvas-controls"
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
        aria-label="Fit map"
        onClick={controller.fitMap}
      >
        Fit map
      </button>
      <button
        {...toolbar.itemProps(4)}
        type="button"
        aria-label="Fit selection"
        onClick={controller.fitSelection}
      >
        Fit selection
      </button>
    </div>
  );
}
