/* eslint-disable @typescript-eslint/no-explicit-any */
import { create } from "zustand";
import { callHost } from "@/lib/host";

// Keep this in sync with backend but stay permissive (all optional)
export type DiscoveryRun = {
  run_id: string;
  workspace_id: string;
  playbook_id: string;
  status: "created" | "pending" | "running" | "completed" | "failed" | "canceled";
  model_id?: string | null;

  // Friendly metadata
  title?: string | null;
  description?: string | null;

  // Timestamps
  created_at?: string | null;
  updated_at?: string | null;
  started_at?: string | null;
  finished_at?: string | null;

  // New fields from discovery-service
  input_fingerprint?: string | null;
  input_diff?: any;         // ← important for Merge-from-Run UI
  strategy?: string | null;

  // Full inputs snapshot captured at run creation
  inputs?: any;             // ← important for Promote-to-Baseline

  // Optional result summary attached on completion
  result_summary?: {
    run_id: string;
    workspace_id: string;
    playbook_id: string;
    artifact_ids?: string[];
    validations?: any[];
    logs?: string[];
    started_at?: string;
    completed_at?: string;
    duration_s?: number | string | { $numberDouble: string };
    title?: string | null;
    description?: string | null;
  } | null;

  // Optional artifacts/deltas (future-proof)
  artifacts?: any[];
  deltas?: { counts?: Partial<Record<"new" | "updated" | "unchanged" | "retired" | "deleted", number>> };

  error?: string | null;
};

type State = {
  items: DiscoveryRun[];
  loading: boolean;
  error?: string;

  selectedRunId?: string;

  load: (workspaceId: string) => Promise<void>;
  refreshOne: (runId: string) => Promise<void>;
  delete: (runId: string) => Promise<void>;
  start: (workspaceId: string, requestBody: any) => Promise<string | undefined>;
  select: (runId?: string) => void;
};

export const useRunsStore = create<State>((set, get) => ({
  items: [],
  loading: false,
  error: undefined,
  selectedRunId: undefined,

  async load(workspaceId: string) {
    set({ loading: true, error: undefined });
    try {
      const runs = await callHost<DiscoveryRun[]>({
        type: "runs:list",
        payload: { workspaceId, limit: 100, offset: 0 },
      });
      set({ items: runs, loading: false });
      // Keep selected id if it still exists
      const { selectedRunId } = get();
      if (selectedRunId && !runs.some(r => r.run_id === selectedRunId)) {
        set({ selectedRunId: undefined });
      }
    } catch (e: any) {
      set({ error: e?.message ?? "Failed to load runs", loading: false });
    }
  },

  async refreshOne(runId: string) {
    try {
      const full = await callHost<DiscoveryRun>({ type: "runs:get", payload: { runId } });
      const { items } = get();
      const idx = items.findIndex(r => r.run_id === runId);
      if (idx >= 0) {
        const next = items.slice();
        next[idx] = { ...items[idx], ...full };
        set({ items: next });
      } else {
        set({ items: [full, ...items] });
      }
    } catch (e: any) {
      set({ error: e?.message ?? "Failed to refresh run" });
    }
  },

  async delete(runId: string) {
    try {
      await callHost({ type: "runs:delete", payload: { runId } });
      const items = get().items.filter(r => r.run_id !== runId);
      set({ items });
      if (get().selectedRunId === runId) set({ selectedRunId: undefined });
    } catch (e: any) {
      set({ error: e?.message ?? "Failed to delete run" });
    }
  },

  async start(workspaceId: string, requestBody: any) {
    try {
      const res = await callHost<{ run_id: string }>({
        type: "runs:start",
        payload: { workspaceId, requestBody },
      });
      return res?.run_id;
    } catch (e: any) {
      set({ error: e?.message ?? "Failed to start run" });
      return undefined;
    }
  },

  select(runId?: string) {
    set({ selectedRunId: runId });
  },
}));
