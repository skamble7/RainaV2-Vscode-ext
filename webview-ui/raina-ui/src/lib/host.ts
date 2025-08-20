/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-expressions */
import { vscode } from "@/lib/vscode";   // ✅ use the existing helper
import { useEffect } from "react";

type Resolver = { resolve: (v: any) => void; reject: (e: any) => void };
const pending = new Map<string, Resolver>();

let listenerAttached = false;
function ensureListener() {
  if (listenerAttached) return;
  window.addEventListener("message", (e: MessageEvent) => {
    const { token, ok, data, error } = (e.data ?? {}) as any;
    if (!token || !pending.has(token)) return;
    const { resolve, reject } = pending.get(token)!;
    pending.delete(token);
    ok ? resolve(data) : reject(new Error(error || "Host error"));
  });
  listenerAttached = true;
}

export type HostReq =
  // Workspaces
  | { type: "workspace:list" }
  | { type: "workspace:create"; payload: { name: string; description?: string; created_by?: string } }
  | { type: "workspace:get"; payload: { id: string } }
  | { type: "workspace:update"; payload: { id: string; patch: { name?: string; description?: string } } }
  // Artifacts
  | { type: "artifact:get"; payload: { workspaceId: string; artifactId: string } }
  | { type: "artifact:head"; payload: { workspaceId: string; artifactId: string } }
  | { type: "artifact:patch"; payload: { workspaceId: string; artifactId: string; etag: string; patch: any[]; provenance?: any } }
  | { type: "artifact:replace"; payload: { workspaceId: string; artifactId: string; etag: string; dataPayload: any; provenance?: any } }
  | { type: "artifact:delete"; payload: { workspaceId: string; artifactId: string } }
  | { type: "artifact:history"; payload: { workspaceId: string; artifactId: string } }
  // Runs (NEW)
  | { type: "runs:list"; payload: { workspaceId: string; limit?: number; offset?: number } }
  | { type: "runs:get"; payload: { runId: string } }
  | { type: "runs:delete"; payload: { runId: string } }
  | { type: "runs:start"; payload: { workspaceId: string; requestBody: any } };

export function callHost<T>(req: HostReq): Promise<T> {
  if (!vscode.available()) throw new Error("VS Code API not available");
  ensureListener();

  const token = crypto.randomUUID();
  const p = new Promise<T>((resolve, reject) => pending.set(token, { resolve, reject }));
  vscode.postMessage({ ...req, token });
  return p;
}

// ---- Optional niceties ----

/** Strongly-typed outgoing message shape */
export type OutgoingMessage<T = any> = {
  type: string;
  payload?: T;
};

/** Strongly-typed incoming message shape */
export type IncomingMessage<T = any> = {
  type: string;
  payload?: T;
};

/** React hook: subscribe to messages from the extension */
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
