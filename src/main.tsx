import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@xyflow/react/dist/style.css";

import { App } from "./app/App";
import "./styles.css";
import "./money-map/styles/canvas.css";
import "./money-map/themes/themes.css";

const root = document.getElementById("root");

if (!root) {
  throw new Error("Missing #root application mount.");
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
