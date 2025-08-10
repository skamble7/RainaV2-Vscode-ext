/* eslint-disable @typescript-eslint/no-explicit-any */
// Minimal typings for the VS Code webview API
export interface VSCodeAPI {
  postMessage: (message: unknown) => void;
  setState: <T>(newState: T) => void;
  getState: <T>() => T | undefined;
}

// Lazily acquire and cache the VS Code API if we're inside a webview
function createGetter() {
  let cached: VSCodeAPI | null = null;
  return (): VSCodeAPI | null => {
    if (cached) return cached;
    const w = globalThis as any;
    if (w && typeof w.acquireVsCodeApi === "function") {
      cached = w.acquireVsCodeApi();
    }
    return cached;
  };
}
const getVSCodeAPI = createGetter();

/** A tiny façade with no-ops when not in a webview (e.g. local Vite dev) */
export const vscode = {
  available(): boolean {
    return !!getVSCodeAPI();
  },
  postMessage(message: unknown): void {
    getVSCodeAPI()?.postMessage(message);
  },
  setState<T>(state: T): void {
    getVSCodeAPI()?.setState(state);
  },
  getState<T>(): T | undefined {
    return getVSCodeAPI()?.getState<T>();
  },
};

// ---- Optional niceties ----

/** Strongly-typed outgoing message shape (customize as you grow) */
export type OutgoingMessage<T = any> = {
  type: string;
  payload?: T;
};

/** Strongly-typed incoming message shape from the extension */
export type IncomingMessage<T = any> = {
  type: string;
  payload?: T;
};

/** React hook: subscribe to messages from the extension */
import { useEffect } from "react";

export function useVSCodeMessages<T = any>(
  handler: (message: IncomingMessage<T>) => void,
  deps: unknown[] = []
) {
  useEffect(() => {
    const onMessage = (event: MessageEvent<IncomingMessage<T>>) => {
      handler(event.data);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
