import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

// No direct window.vscode assignment here — we use the wrapper
import { vscode } from "./lib/vscode";

// Quick test: send a hello message to the extension as soon as the app mounts
vscode.postMessage({ type: "hello", payload: { from: "React App started" } });

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
