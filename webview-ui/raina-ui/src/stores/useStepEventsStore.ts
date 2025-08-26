/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
//webview-ui/raina-ui/src/stores/useStepEventsStore.ts
import { create } from "zustand";

export type StepStatus = "pending" | "started" | "completed" | "failed";

export type StepMeta = {
  id: string;
  capability_id: string;
  name?: string | null;
  produces_kinds?: string[];
};

export type StepEntry = StepMeta & {
  status: StepStatus;
  started_at?: string;
  ended_at?: string;
  duration_s?: number;
  error?: string;
  params?: any;
};

type PerRunState = {
  order: string[];
  steps: Record<string, StepEntry>;
};

type State = {
  byRun: Record<string, PerRunState>;
  preloadSteps: (runId: string, steps: StepMeta[]) => void;
  ingestWsEvent: (evt: any) => void;
  resetRun: (runId: string) => void;
};

function ensure(state: State["byRun"], runId: string): PerRunState {
  if (!state[runId]) state[runId] = { order: [], steps: {} };
  return state[runId];
}

export const useStepEventsStore = create<State>((set, get) => ({
  byRun: {},

  preloadSteps(runId, steps) {
    set((s) => {
      const r = ensure(s.byRun, runId);
      for (const m of steps) {
        const id = m.id;
        if (!(id in r.steps)) {
          r.steps[id] = { ...m, status: "pending" };
          r.order.push(id);
        }
      }
      return { byRun: { ...s.byRun, [runId]: { ...r, steps: { ...r.steps }, order: [...r.order] } } };
    });
  },

  ingestWsEvent(evt: any) {
    try {
      const evName = (evt?.event || evt?.type || "").toString();

      const isStep =
        evName.endsWith("discovery.step.started.v1") ||
        evName.endsWith("discovery.step.completed.v1") ||
        evName.endsWith("discovery.step.failed.v1") ||
        evName === "step.started" ||
        evName === "step.completed" ||
        evName === "step.failed";

      if (!isStep) return;

      const payload = evt.payload ?? evt;
      const runId = String(payload.run_id || "");
      if (!runId) return;

      const step = payload.step || {};
      const sid = String(step.id || step.capability_id || "").trim();
      if (!sid) return;

      const base: StepMeta = {
        id: sid,
        capability_id: String(step.capability_id || ""),
        name: step.name || null,
        produces_kinds: Array.isArray(payload.produces_kinds)
          ? payload.produces_kinds
          : (Array.isArray(step.produces_kinds) ? step.produces_kinds : []),
      };

      const status: StepStatus =
        payload.status === "completed" ? "completed" :
        payload.status === "failed" ? "failed" :
        payload.status === "started" ? "started" :
        "pending";

      set((s) => {
        const r = ensure(s.byRun, runId);

        if (!(sid in r.steps)) {
          r.steps[sid] = { ...base, status: "pending" };
          r.order.push(sid);
        }

        const cur = r.steps[sid];
        const next: StepEntry = {
          ...cur,
          ...base,
          status:
            cur.status === "completed" || cur.status === "failed"
              ? cur.status
              : status,
          started_at: payload.started_at ?? cur.started_at,
          ended_at: payload.ended_at ?? cur.ended_at,
          duration_s: typeof payload.duration_s === "number" ? payload.duration_s : cur.duration_s,
          error: payload.error ?? cur.error,
          params: payload.params ?? cur.params,
        };

        if (status === "failed" || status === "completed") {
          next.status = status;
        } else if (status === "started" && (cur.status === "pending" || cur.status === "started")) {
          next.status = "started";
        }

        r.steps[sid] = next;
        return { byRun: { ...s.byRun, [runId]: { ...r, steps: { ...r.steps }, order: [...r.order] } } };
      });
    } catch {
      /* ignore bad events */
    }
  },

  resetRun(runId) {
    set((s) => {
      const copy = { ...s.byRun };
      delete copy[runId];
      return { byRun: copy };
    });
  },
}));
