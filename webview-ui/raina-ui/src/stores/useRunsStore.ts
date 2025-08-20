/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { create } from "zustand";
import { callHost } from "@/lib/host";

/** Mirror of backend enum */
export type RunStatus = "pending" | "running" | "completed" | "failed" | "canceled";

/** Minimal run shape we need for listing/details */
export type DiscoveryRun = {
  run_id: string;
  workspace_id: string;
  playbook_id: string;
  model_id?: string;
  status: RunStatus;
  started_at?: string;
  finished_at?: string;
  input_fingerprint?: string;
  input_diff?: any;
  strategy?: string;
  error?: string | null;

  // NEW: friendlier labels
  title?: string;
  description?: string;

  // NEW: we need artifact IDs from the result summary
  result_summary?: {
    run_id?: string;
    workspace_id?: string;
    playbook_id?: string;
    artifact_ids?: string[];
    started_at?: string;
    completed_at?: string;
    title?: string;
    description?: string;
  };
};

type Store = {
  // data
  loading: boolean;
  error?: string;
  items: DiscoveryRun[];
  selectedRunId?: string;

  // actions
  load: (workspaceId: string, opts?: { limit?: number; offset?: number }) => Promise<void>;
  refreshOne: (runId: string) => Promise<void>;
  delete: (runId: string) => Promise<void>;
  start: (workspaceId: string, requestBody: any) => Promise<string | undefined>;
  select: (runId?: string) => void;
  clear: () => void;
};

export const useRunsStore = create<Store>((set, get) => ({
  loading: false,
  items: [],

  async load(workspaceId, opts) {
    set({ loading: true, error: undefined });
    try {
      const list = await callHost<DiscoveryRun[]>({
        type: "runs:list",
        payload: { workspaceId, limit: opts?.limit ?? 50, offset: opts?.offset ?? 0 },
      });
      set({ items: list ?? [], loading: false });
    } catch (e: any) {
      set({ error: e?.message ?? "Failed to load runs", loading: false });
    }
  },

  async refreshOne(runId) {
    try {
      const run = await callHost<DiscoveryRun>({ type: "runs:get", payload: { runId } });
      if (!run) return;
      set((s) => ({ items: s.items.map((x) => (x.run_id === runId ? run : x)) }));
    } catch {
      /* ignore one-off errors */
    }
  },

  async delete(runId) {
    await callHost({ type: "runs:delete", payload: { runId } });
    set((s) => ({
      items: s.items.filter((x) => x.run_id !== runId),
      selectedRunId: s.selectedRunId === runId ? undefined : s.selectedRunId,
    }));
  },

  async start(workspaceId, requestBody) {
    const res = await callHost<any>({ type: "runs:start", payload: { workspaceId, requestBody } });
    const runId = res?.run_id as string | undefined;

    // Optimistically append a placeholder entry so the user sees it immediately
    if (runId) {
      set((s) => ({
        items: [
          {
            run_id: runId,
            workspace_id: workspaceId,
            playbook_id: res?.playbook_id ?? (requestBody?.playbook_id as string | undefined) ?? "unknown",
            status: "pending",
            started_at: new Date().toISOString(),
            title: res?.title ?? requestBody?.title ?? "New run",
            description: res?.description ?? requestBody?.description,
          },
          ...s.items,
        ],
      }));
    }
    return runId;
  },

  select: (runId) => set({ selectedRunId: runId }),

  clear: () => set({ loading: false, error: undefined, items: [], selectedRunId: undefined }),
}));
