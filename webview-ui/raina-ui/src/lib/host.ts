/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-expressions */
// webview-ui/raina-ui/src/lib/host.ts
import { vscode } from "@/lib/vscode";

type Resolver = { resolve: (v: any) => void; reject: (e: any) => void };
const pending = new Map<string, Resolver>();

// Attach one global listener
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
  | { type: "workspace:list" }
  | { type: "workspace:create"; payload: { name: string; description?: string; created_by?: string } }
  | { type: "workspace:get"; payload: { id: string } }                // NEW
  | { type: "discovery:start"; payload: { workspaceId: string; options?: any } }; 

export function callHost<T>(req: HostReq): Promise<T> {
  if (!vscode.available()) throw new Error("VS Code API not available");
  ensureListener();

  const token = crypto.randomUUID();
  const p = new Promise<T>((resolve, reject) => pending.set(token, { resolve, reject }));
  vscode.postMessage({ ...req, token });
  return p;
}
