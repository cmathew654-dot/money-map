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
  return (
    <div className="canvas-controls" role="toolbar" aria-label="Canvas camera">
      <div className="canvas-controls__zoom">
        <button type="button" aria-label="Zoom out" onClick={controller.zoomOut}>
          <span aria-hidden="true">−</span>
        </button>
        <button
          className="canvas-controls__percentage"
          type="button"
          aria-label="Reset zoom to 100%"
          onClick={controller.resetZoom}
        >
          {zoomPercentage}%
        </button>
        <button type="button" aria-label="Zoom in" onClick={controller.zoomIn}>
          <span aria-hidden="true">+</span>
        </button>
      </div>
      <button type="button" aria-label="Fit map" onClick={controller.fitMap}>
        Fit map
      </button>
      <button type="button" aria-label="Fit selection" onClick={controller.fitSelection}>
        Fit selection
      </button>
    </div>
  );
}
