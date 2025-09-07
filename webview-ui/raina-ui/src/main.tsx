import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

import PackDesignerView from "./components/capability/PackDesignerView";
import { vscode } from "./lib/vscode";
import { bootstrapWsBridge } from "./lib/bootstrapWs";

// Bridge is fine for both apps (no-ops if unused)
bootstrapWsBridge();
vscode.postMessage({ type: "hello", payload: { from: "React App started" } });

const rootEl = document.getElementById("root")!;
const initAttr = rootEl.getAttribute("data-initial");

// If the webview was created by PackDesignerPanel, it injects data-initial.
// Parse it and render the designer; otherwise render the normal Raina app.
let initial: { key?: string; version?: string } | null = null;
if (initAttr !== null) {
  try {
    initial = JSON.parse(initAttr || "{}");
  } catch {
    initial = {};
  }
}

const node = (
  <React.StrictMode>
    {initAttr !== null ? (
      <PackDesignerView initialKey={initial?.key} initialVersion={initial?.version} />
    ) : (
      <App />
    )}
  </React.StrictMode>
);

ReactDOM.createRoot(rootEl).render(node);
