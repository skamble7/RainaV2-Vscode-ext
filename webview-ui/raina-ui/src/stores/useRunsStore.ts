/* eslint-disable @typescript-eslint/no-explicit-any */
//webview-ui/raina-ui/src/stores/useRunsStore.ts
import { create } from "zustand";
import { callHost } from "@/lib/host";

// ---- Step event types -------------------------------------------------------

export type StepInfo = {
  id: string;
  capability_id?: string;
  name?: string;
};

export type StepEvent = {
  run_id: string;
  workspace_id?: string;
  playbook_id?: string;
  step: StepInfo;
  status: "started" | "completed" | "failed" | string;
  params?: any;
  started_at?: string;
  ended_at?: string;
  duration_s?: number | string | { $numberDouble: string };
  produces_kinds?: string[];
  error?: string;
};

// ---- Run snapshot type ------------------------------------------------------

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

  // From discovery-service
  input_fingerprint?: string | null;
  input_diff?: any;
  strategy?: string | null;

  // Full inputs snapshot captured at run creation
  inputs?: any;

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

  // ---- Live step state (NEW) ----------------------------------------------
  /** Rolling list of raw step events as they arrive over WS (not persisted). */
  step_events?: StepEvent[];
  /**
   * Latest status per step.id, built from step_events — and also preloaded
   * from the capability pack so totals show up immediately.
   */
  live_steps?: Record<string, StepEvent>;
};

// ---- Store -----------------------------------------------------------------

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

  // Ingest a single step event (raina.discovery.step.* payload or flattened)
  applyStepEvent: (evt: any) => void;

  // Pre-seed known steps (from capability pack/playbook) as "pending"
  seedLiveSteps: (
    runId: string,
    metas: Array<{ id: string; capability_id: string; name?: string; produces_kinds?: string[] }>,
    opts?: { markDoneIfRunCompleted?: boolean }
  ) => void;
};

export const useRunsStore = create<State>((set, get) => ({
  items: [],
  loading: false,
  error: undefined,
  selectedRunId: undefined,

  // ---- CRUD over runs ------------------------------------------------------

  async load(workspaceId: string) {
    set({ loading: true, error: undefined });
    try {
      const runs = await callHost<DiscoveryRun[]>({
        type: "runs:list",
        payload: { workspaceId, limit: 100, offset: 0 },
      });
      set({ items: runs, loading: false });

      // Keep selection if it still exists
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
        const prev = items[idx];

        // Preserve any live step state while updating snapshot
        const next: DiscoveryRun = {
          ...prev,
          ...full,
          step_events: prev.step_events ?? [],
          live_steps: { ...(prev.live_steps ?? {}) },
        };

        // If the run is completed but all seeded steps are still "pending"
        // (because we missed per-step events), mark them completed so the
        // tracker shows N/N done instead of 0/N.
        if (next.status === "completed" && next.live_steps && Object.keys(next.live_steps).length > 0) {
          const vals = Object.values(next.live_steps);
          const allPending = vals.every((e: any) => (e?.status ?? "pending") === "pending");
          if (allPending) {
            for (const k of Object.keys(next.live_steps)) {
              next.live_steps[k] = { ...next.live_steps[k], status: "completed" } as any;
            }
          }
        }

        const arr = items.slice();
        arr[idx] = next;
        set({ items: arr });
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

  // ---- Live step plumbing --------------------------------------------------

  seedLiveSteps(runId, metas, opts) {
    const { items } = get();
    const idx = items.findIndex(r => r.run_id === runId);
    if (idx < 0) return;

    const prev = items[idx];
    const live = { ...(prev.live_steps ?? {}) };

    // Insert any missing steps as "pending", enriching labels/kinds if present.
    for (const m of metas) {
      const ex = live[m.id];
      if (!ex) {
        live[m.id] = {
          run_id: prev.run_id,
          status: "pending",
          step: { id: m.id, capability_id: m.capability_id, name: m.name },
          produces_kinds: m.produces_kinds ?? [],
        } as any;
      } else {
        live[m.id] = {
          ...ex,
          step: {
            id: m.id,
            capability_id: ex.step?.capability_id ?? m.capability_id,
            name: ex.step?.name ?? m.name,
          },
          produces_kinds: (ex.produces_kinds && ex.produces_kinds.length > 0)
            ? ex.produces_kinds
            : (m.produces_kinds ?? []),
        };
      }
    }

    // If snapshot says "completed" and none of the steps advanced, mark done.
    if (opts?.markDoneIfRunCompleted && prev.status === "completed") {
      const vals = Object.values(live);
      if (vals.length && vals.every((e: any) => (e?.status ?? "pending") === "pending")) {
        for (const k of Object.keys(live)) {
          live[k] = { ...live[k], status: "completed" } as any;
        }
      }
    }

    const next: DiscoveryRun = {
      ...prev,
      live_steps: live,
      step_events: prev.step_events ?? [],
    };

    const arr = items.slice();
    arr[idx] = next;
    set({ items: arr });
  },

  applyStepEvent(evt: any) {
    // Events can arrive as {meta, data} or as flattened payloads.
    const d = evt?.data ?? evt;
    const run_id: string | undefined = d?.run_id;
    const step = d?.step;
    const status: string | undefined = d?.status;

    if (!run_id || !step?.id || !status) return;

    const { items } = get();
    const idx = items.findIndex(r => r.run_id === run_id);
    if (idx < 0) return; // Unknown run; ignore quietly.

    const prev = items[idx];

    // Normalize duration to a primitive number if possible
    let duration_s: number | undefined;
    const rawDur = d.duration_s;
    if (typeof rawDur === "number") duration_s = rawDur;
    else if (typeof rawDur === "string") duration_s = Number(rawDur);
    else if (rawDur && typeof rawDur === "object" && typeof rawDur.$numberDouble === "string") {
      duration_s = Number(rawDur.$numberDouble);
    }

    // Merge with any existing entry for that step
    const ex = prev.live_steps?.[step.id];

    const merged: StepEvent = {
      ...(ex ?? {}),
      ...d,
      step: {
        id: step.id,
        capability_id: step.capability_id ?? ex?.step?.capability_id,
        name: step.name ?? ex?.step?.name,
      },
      produces_kinds:
        Array.isArray(d.produces_kinds) && d.produces_kinds.length
          ? d.produces_kinds
          : (Array.isArray(ex?.produces_kinds) ? ex?.produces_kinds : []),
      duration_s,
    };

    // Write back to live map
    const live_steps = { ...(prev.live_steps ?? {}) };
    live_steps[step.id] = merged;

    const step_events = [...(prev.step_events ?? []), merged];

    // If any step starts while run is pending, bump run to running (UI nicety)
    let statusPatch: Partial<DiscoveryRun> = {};
    if (status === "started" && prev.status === "pending") {
      statusPatch = { status: "running" as DiscoveryRun["status"] };
    }

    const next: DiscoveryRun = {
      ...prev,
      ...statusPatch,
      live_steps,
      step_events,
    };

    const arr = items.slice();
    arr[idx] = next;
    set({ items: arr });
  },
}));
