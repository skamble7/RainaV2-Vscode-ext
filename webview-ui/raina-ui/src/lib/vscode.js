// Lazily acquire and cache the VS Code API if we're inside a webview
function createGetter() {
    let cached = null;
    return () => {
        if (cached)
            return cached;
        const w = globalThis;
        if (w && typeof w.acquireVsCodeApi === "function") {
            cached = w.acquireVsCodeApi();
        }
        return cached;
    };
}
const getVSCodeAPI = createGetter();
/** A tiny façade with no-ops when not in a webview (e.g. local Vite dev) */
export const vscode = {
    available() {
        return !!getVSCodeAPI();
    },
    postMessage(message) {
        getVSCodeAPI()?.postMessage(message);
    },
    setState(state) {
        getVSCodeAPI()?.setState(state);
    },
    getState() {
        return getVSCodeAPI()?.getState();
    },
};
/** React hook: subscribe to messages from the extension */
import { useEffect } from "react";
export function useVSCodeMessages(handler, deps = []) {
    useEffect(() => {
        const onMessage = (event) => {
            handler(event.data);
        };
        window.addEventListener("message", onMessage);
        return () => window.removeEventListener("message", onMessage);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, deps);
}
//# sourceMappingURL=vscode.js.map