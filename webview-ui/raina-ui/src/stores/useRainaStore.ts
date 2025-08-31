/* eslint-disable @typescript-eslint/no-unused-expressions */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { callHost } from "@/lib/host";

/** ----------------------
 * Types (aligned to backend)
 * ---------------------- */

export type StepStatus = "pending" | "started" | "completed" | "failed";

export type StepInfo = { id: string; capability_id?: string; name?: string; };
export type StepEvent = {
  run_id: string;
  workspace_id?: string;
  playbook_id?: string;
  step: StepInfo;
  status: StepStatus | string;
  params?: any;
  started_at?: string;
  ended_at?: string;
  duration_s?: number | string | { $numberDouble: string };
  produces_kinds?: string[];
  error?: string;
};

export type DiscoveryRun = {
  run_id: string;
  workspace_id: string;
  playbook_id: string;
  status: "created" | "pending" | "running" | "completed" | "failed" | "canceled";
  model_id?: string | null;
  title?: string | null;
  description?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  started_at?: string | null;
  finished_at?: string | null;
  input_fingerprint?: string | null;
  input_diff?: any;
  strategy?: string | null;
  inputs?: any;
  result_summary?: any | null;
  artifacts?: any[];
  deltas?: { counts?: Partial<Record<"new" | "updated" | "unchanged" | "retired" | "deleted", number>> };
  error?: string | null;
  step_events?: StepEvent[];
  live_steps?: Record<string, StepEvent>;
};

export type Artifact = {
  artifact_id: string;
  kind: string;       // e.g. "cam.contract.api"
  name: string;
  data: any;
  version?: number | { $numberInt: string };
  fingerprint?: string;
  natural_key?: string;
  created_at?: any;
  updated_at?: any;
  deleted_at?: any;
  provenance?: any;
  lineage?: any;
};

export type WorkspaceHeader = {
  _id: string;
  name: string;
  description?: string | null;
  created_by?: string | null;
  created_at?: any;
  updated_at?: any;
};

export type WorkspaceArtifactsDoc = {
  _id: string;
  workspace_id: string;
  workspace: WorkspaceHeader;
  inputs_baseline?: any;
  inputs_baseline_fingerprint?: string;
  inputs_baseline_version?: number | { $numberInt: string };
  last_promoted_run_id?: string | null;
  artifacts: Artifact[];
  created_at?: any;
  updated_at?: any;
};

export type ArtifactFilters = {
  q: string;
  kinds: Set<string>;
};

type Counts = {
  total: number;
  byCategory: Record<string, number>; // e.g. { diagram: 3, contract: 2, data: 1 }
};

const clone = <T,>(v: T): T =>
  typeof (globalThis as any).structuredClone === "function"
    ? (structuredClone as any)(v)
    : JSON.parse(JSON.stringify(v));

function normalizeDuration(v: any): number | undefined {
  if (typeof v === "number") return v;
  if (typeof v === "string") return Number(v);
  if (v && typeof v === "object" && typeof v.$numberDouble === "string") return Number(v.$numberDouble);
  return undefined;
}

/** ----------------------
 * Store shape
 * ---------------------- */

type UIState = {
  tab: "overview" | "artifacts" | "conversations" | "timeline" | "runs";
  rightOpen: boolean;
  rightMode: "details" | "agent";
};

type CapabilityDefaults = {
  pack_key?: string;
  pack_version?: string;
  model?: string;
};

type KindRegistryItem = {
  _id: string;
  title: string;
  category?: string;
  latest_schema_version?: string;
  schema_versions?: Array<{ version: string; json_schema: any }>;
};

type RainaState = {
  loading: boolean;
  error?: string;

  currentWorkspaceId?: string;
  wsDoc?: WorkspaceArtifactsDoc;

  artifacts: Artifact[];
  etags: Record<string, string | undefined>;
  selectedArtifactId?: string;
  draftById: Record<string, any | undefined>;

  runs: DiscoveryRun[];
  selectedRunId?: string;

  // registry
  kindIndex: Record<string, KindRegistryItem>;
  getKindSchema: (key: string) => Promise<KindRegistryItem | undefined>;
  ensureKindsLoaded: () => Promise<void>;

  // filters & UI
  filters: ArtifactFilters;
  ui: UIState;

  // capability defaults
  capabilityDefaults: CapabilityDefaults;
  setCapabilityDefaults: (d: Partial<CapabilityDefaults>) => void;
  deriveCapabilityDefaults: () => void;

  // actions
  switchWorkspace: (workspaceId?: string) => Promise<void>;
  reloadWorkspace: () => Promise<void>;

  setTab: (t: UIState["tab"]) => void;
  openRight: (mode?: "details" | "agent") => void;
  closeRight: () => void;

  selectArtifact: (id?: string) => Promise<void>;
  selectRun: (runId?: string) => void;

  refreshArtifact: (artifactId: string) => Promise<void>;
  patchArtifact: (artifactId: string, patch: any[], provenance?: any) => Promise<"ok" | "conflict">;
  replaceArtifact: (artifactId: string, dataPayload: any, provenance?: any) => Promise<"ok" | "conflict">;
  deleteArtifact: (artifactId: string) => Promise<void>;
  loadArtifactHistory: (artifactId: string) => Promise<any[]>;

  updateWorkspaceMeta: (patch: { name?: string; description?: string }) => Promise<void>;

  loadRuns: () => Promise<void>;
  refreshRun: (runId: string) => Promise<void>;
  deleteRun: (runId: string) => Promise<void>;
  startRun: (requestBody: any) => Promise<string | undefined>;

  seedLiveSteps: (
    runId: string,
    metas: Array<{ id: string; capability_id: string; name?: string; produces_kinds?: string[] }>,
    opts?: { markDoneIfRunCompleted?: boolean }
  ) => void;
  applyStepEvent: (evt: any) => void;

  isDirty: (id: string) => boolean;
  startEdit: (id: string) => void;
  updateDraft: (id: string, updater: (draft: any) => void) => void;
  cancelEdit: (id: string) => void;
  saveDraft: (id: string, provenance?: any) => Promise<"ok" | "conflict">;

  setQuery: (q: string) => void;
  toggleKind: (k: string) => void;

  filteredArtifacts: () => Artifact[];
  counts: () => Counts;
};

/** ----------------------
 * Implementation
 * ---------------------- */

export const useRainaStore = create<RainaState>((set, get) => ({
  loading: false,
  artifacts: [],
  etags: {},
  draftById: {},
  runs: [],
  kindIndex: {},

  filters: { q: "", kinds: new Set() },
  ui: { tab: "artifacts", rightOpen: false, rightMode: "details" },

  capabilityDefaults: {},
  setCapabilityDefaults: (d) => set((s) => ({ capabilityDefaults: { ...s.capabilityDefaults, ...d } })),
  deriveCapabilityDefaults() {
    const { artifacts, runs } = get();
    for (const a of artifacts) {
      const pk = (a as any)?.provenance?.pack_key as string | undefined;
      const pv = (a as any)?.provenance?.pack_version as string | undefined;
      const model = (a as any)?.provenance?.model_id as string | undefined;
      if (pk && pv) {
        set((s) => ({
          capabilityDefaults: {
            ...s.capabilityDefaults,
            pack_key: pk,
            pack_version: pv,
            model: model ?? s.capabilityDefaults.model,
          },
        }));
        break;
      }
    }
    if (!get().capabilityDefaults.model) {
      const modelFromRun = runs.find((r) => !!r.model_id)?.model_id ?? undefined;
      if (modelFromRun) get().setCapabilityDefaults({ model: modelFromRun || undefined });
    }
  },

  async ensureKindsLoaded() {
    if (Object.keys(get().kindIndex).length) return;
    try {
      const list = await callHost<KindRegistryItem[]>({ type: "registry:kinds:list", payload: { limit: 200, offset: 0 } });
      const idx: Record<string, KindRegistryItem> = {};
      for (const k of list ?? []) idx[k._id] = k;
      set({ kindIndex: idx });
    } catch {
      // non-fatal; on-demand getKindSchema can still work
    }
  },

  async getKindSchema(key: string) {
    if (!key) return undefined;
    const existing = get().kindIndex[key];
    if (existing?.schema_versions?.length) return existing;
    try {
      const one = await callHost<KindRegistryItem>({ type: "registry:kind:get", payload: { key } });
      set((s) => ({ kindIndex: { ...s.kindIndex, [key]: one } }));
      return one;
    } catch {
      return existing; // best-effort
    }
  },

  async switchWorkspace(workspaceId) {
    set({
      loading: true,
      error: undefined,
      currentWorkspaceId: workspaceId,
      wsDoc: undefined,
      artifacts: [],
      etags: {},
      draftById: {},
      runs: [],
      selectedRunId: undefined,
      selectedArtifactId: undefined,
      filters: { q: "", kinds: new Set() },
      ui: { tab: "artifacts", rightOpen: false, rightMode: "details" },
      capabilityDefaults: {},
    });

    if (!workspaceId) {
      set({ loading: false });
      return;
    }

    try {
      await get().ensureKindsLoaded();
      const [detail, runs] = await Promise.all([
        callHost<WorkspaceArtifactsDoc>({ type: "workspace:get", payload: { id: workspaceId } }),
        callHost<DiscoveryRun[]>({ type: "runs:list", payload: { workspaceId, limit: 100, offset: 0 } }),
      ]);

      set({
        wsDoc: detail,
        artifacts: detail?.artifacts ?? [],
        runs,
        loading: false,
      });

      get().deriveCapabilityDefaults();
    } catch (e: any) {
      set({ error: e?.message ?? "Failed to load workspace", loading: false });
    }
  },

  async reloadWorkspace() {
    const id = get().currentWorkspaceId;
    if (!id) return;
    return get().switchWorkspace(id);
  },

  setTab: (t) => set((s) => ({ ui: { ...s.ui, tab: t } })),
  openRight: (mode) => set((s) => ({ ui: { ...s.ui, rightOpen: true, rightMode: mode ?? "details" } })),
  closeRight: () => set((s) => ({ ui: { ...s.ui, rightOpen: false } })),

  async selectArtifact(id) {
    set({ selectedArtifactId: id });
    if (id) {
      set((s) => ({ ui: { ...s.ui, rightOpen: true, rightMode: "details" } }));
      try { await get().refreshArtifact(id); } catch { /* ignore */ }
    }
  },
  selectRun: (runId) => set({ selectedRunId: runId }),

  async refreshArtifact(artifactId) {
    const ws = get().currentWorkspaceId;
    if (!ws) return;
    const { data, etag } = await callHost<{ data: Artifact; etag?: string }>({
      type: "artifact:get",
      payload: { workspaceId: ws, artifactId },
    });
    set((s) => ({
      artifacts: s.artifacts.map((a) => (a.artifact_id === artifactId ? (data as any) : a)),
      etags: { ...s.etags, [artifactId]: etag },
    }));
    if (!get().capabilityDefaults.pack_key || !get().capabilityDefaults.pack_version) {
      get().deriveCapabilityDefaults();
    }
  },

  async patchArtifact(artifactId, patch, provenance) {
    const ws = get().currentWorkspaceId;
    if (!ws) return "conflict";

    let etag = get().etags[artifactId];
    if (!etag) {
      const head = await callHost<{ etag?: string }>({
        type: "artifact:head",
        payload: { workspaceId: ws, artifactId },
      });
      etag = head.etag;
    }

    try {
      const result = await callHost<{ data: Artifact; etag?: string }>({
        type: "artifact:patch",
        payload: { workspaceId: ws, artifactId, etag: etag as string, patch, provenance },
      });
      set((s) => ({
        artifacts: s.artifacts.map((a) => (a.artifact_id === artifactId ? (result.data as any) : a)),
        etags: { ...s.etags, [artifactId]: result.etag },
      }));
      get().deriveCapabilityDefaults();
      return "ok";
    } catch (e: any) {
      if (e?.message === "PRECONDITION_FAILED") return "conflict";
      throw e;
    }
  },

  async replaceArtifact(artifactId, dataPayload, provenance) {
    const ws = get().currentWorkspaceId;
    if (!ws) return "conflict";

    let etag = get().etags[artifactId];
    if (!etag) {
      const head = await callHost<{ etag?: string }>({
        type: "artifact:head",
        payload: { workspaceId: ws, artifactId },
      });
      etag = head.etag;
    }

    try {
      const result = await callHost<{ data: Artifact; etag?: string }>({
        type: "artifact:replace",
        payload: { workspaceId: ws, artifactId, etag: etag as string, dataPayload, provenance },
      });
      set((s) => ({
        artifacts: s.artifacts.map((a) => (a.artifact_id === artifactId ? (result.data as any) : a)),
        etags: { ...s.etags, [artifactId]: result.etag },
      }));
      get().deriveCapabilityDefaults();
      return "ok";
    } catch (e: any) {
      if (e?.message === "PRECONDITION_FAILED") return "conflict";
      throw e;
    }
  },

  async deleteArtifact(artifactId) {
    const ws = get().currentWorkspaceId;
    if (!ws) return;
    await callHost({ type: "artifact:delete", payload: { workspaceId: ws, artifactId } });
    set((s) => ({
      artifacts: s.artifacts.filter((a) => a.artifact_id !== artifactId),
      etags: Object.fromEntries(Object.entries(s.etags).filter(([k]) => k !== artifactId)),
      selectedArtifactId: s.selectedArtifactId === artifactId ? undefined : s.selectedArtifactId,
      ui: s.selectedArtifactId === artifactId ? { ...s.ui, rightOpen: false } : s.ui,
      draftById: { ...s.draftById, [artifactId]: undefined },
    }));
  },

  async loadArtifactHistory(artifactId) {
    const ws = get().currentWorkspaceId;
    if (!ws) return [];
    return await callHost<any[]>({
      type: "artifact:history",
      payload: { workspaceId: ws, artifactId },
    });
  },

  async updateWorkspaceMeta(patch) {
    const id = get().wsDoc?.workspace?._id;
    if (!id) return;
    await callHost({ type: "workspace:update", payload: { id, patch } });
    set((s) =>
      s.wsDoc
        ? { wsDoc: { ...s.wsDoc, workspace: { ...s.wsDoc.workspace, ...patch } } }
        : {}
    );
  },

  async loadRuns() {
    const ws = get().currentWorkspaceId;
    if (!ws) return;
    const runs = await callHost<DiscoveryRun[]>({
      type: "runs:list",
      payload: { workspaceId: ws, limit: 100, offset: 0 },
    });
    set({ runs });
    const { selectedRunId } = get();
    if (selectedRunId && !runs.some(r => r.run_id === selectedRunId)) {
      set({ selectedRunId: undefined });
    }
    if (!get().capabilityDefaults.model) {
      const modelFromRun = runs.find((r) => !!r.model_id)?.model_id ?? undefined;
      if (modelFromRun) get().setCapabilityDefaults({ model: modelFromRun || undefined });
    }
  },

  async refreshRun(runId: string) {
    try {
      const full = await callHost<DiscoveryRun>({ type: "runs:get", payload: { runId } });
      const { runs } = get();
      const idx = runs.findIndex(r => r.run_id === runId);

      if (idx >= 0) {
        const prev = runs[idx];
        const next: DiscoveryRun = {
          ...prev,
          ...full,
          step_events: prev.step_events ?? [],
          live_steps: { ...(prev.live_steps ?? {}) },
        };
        if (next.status === "completed" && next.live_steps && Object.keys(next.live_steps).length > 0) {
          const vals = Object.values(next.live_steps);
          const allPending = vals.every((e: any) => (e?.status ?? "pending") === "pending");
          if (allPending) {
            for (const k of Object.keys(next.live_steps)) {
              next.live_steps[k] = { ...next.live_steps[k], status: "completed" } as any;
            }
          }
        }
        const arr = runs.slice();
        arr[idx] = next;
        set({ runs: arr });
      } else {
        set({ runs: [full, ...runs] });
      }
      if (full?.model_id && !get().capabilityDefaults.model) {
        get().setCapabilityDefaults({ model: full.model_id || undefined });
      }
    } catch (e: any) {
      set({ error: e?.message ?? "Failed to refresh run" });
    }
  },

  async deleteRun(runId: string) {
    try {
      await callHost({ type: "runs:delete", payload: { runId } });
      const runs = get().runs.filter(r => r.run_id !== runId);
      set({ runs });
      if (get().selectedRunId === runId) set({ selectedRunId: undefined });
    } catch (e: any) {
      set({ error: e?.message ?? "Failed to delete run" });
    }
  },

  async startRun(requestBody: any) {
    try {
      const s = get();
      const ws = s.currentWorkspaceId || s.wsDoc?.workspace_id || s.wsDoc?.workspace?._id || s.wsDoc?._id;
      if (!ws) throw new Error("No workspace selected");

      const current = s.capabilityDefaults ?? {};
      const optsIn = { ...(requestBody?.options ?? {}) };
      const opts = {
        pack_key: optsIn.pack_key ?? current.pack_key ?? "svc-micro",
        pack_version: optsIn.pack_version ?? current.pack_version ?? "v1.4",
        model: optsIn.model ?? current.model ?? "openai:gpt-4o-mini",
        validate: optsIn.validate ?? true,
        dry_run: optsIn.dry_run ?? false,
      };
      set((st) => ({ capabilityDefaults: { ...st.capabilityDefaults, ...opts } }));

      const body = { ...requestBody, workspace_id: requestBody?.workspace_id ?? ws, options: opts };
      const res = await callHost<{ run_id: string }>({ type: "runs:start", payload: { workspaceId: ws, requestBody: body } });
      try { await get().loadRuns(); } catch { /* empty */ }
      return res?.run_id;
    } catch (e: any) {
      set({ error: e?.message ?? "Failed to start run" });
      return undefined;
    }
  },

  seedLiveSteps(runId, metas, opts) {
    const { runs } = get();
    const idx = runs.findIndex(r => r.run_id === runId);
    if (idx < 0) return;

    const prev = runs[idx];
    const live = { ...(prev.live_steps ?? {}) };

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
          produces_kinds:
            (ex.produces_kinds && ex.produces_kinds.length > 0)
              ? ex.produces_kinds
              : (m.produces_kinds ?? []),
        };
      }
    }

    if (opts?.markDoneIfRunCompleted && prev.status === "completed") {
      const vals = Object.values(live);
      if (vals.length && vals.every((e: any) => (e?.status ?? "pending") === "pending")) {
        for (const k of Object.keys(live)) {
          live[k] = { ...live[k], status: "completed" } as any;
        }
      }
    }

    const next: DiscoveryRun = { ...prev, live_steps: live, step_events: prev.step_events ?? [] };
    const arr = runs.slice();
    arr[idx] = next;
    set({ runs: arr });
  },

  applyStepEvent(evt: any) {
    const d = evt?.data ?? evt;
    const run_id: string | undefined = d?.run_id;
    const step = d?.step;
    const status: string | undefined = d?.status;
    if (!run_id || !step?.id || !status) return;

    const { runs } = get();
    const idx = runs.findIndex(r => r.run_id === run_id);
    if (idx < 0) return;

    const prev = runs[idx];
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
      duration_s: normalizeDuration(d.duration_s),
    };

    const live_steps = { ...(prev.live_steps ?? {}) };
    live_steps[step.id] = merged;
    const step_events = [...(prev.step_events ?? []), merged];

    let statusPatch: Partial<DiscoveryRun> = {};
    if (status === "started" && prev.status === "pending") {
      statusPatch = { status: "running" as DiscoveryRun["status"] };
    }

    const next: DiscoveryRun = { ...prev, ...statusPatch, live_steps, step_events };
    const arr = runs.slice();
    arr[idx] = next;
    set({ runs: arr });
  },

  isDirty: (id) => {
    const a = get().artifacts.find((x) => x.artifact_id === id);
    const d = get().draftById[id];
    if (!a || d === undefined) return false;
    return JSON.stringify(a.data) !== JSON.stringify(d);
  },

  startEdit: (id) => {
    const a = get().artifacts.find((x) => x.artifact_id === id);
    if (!a) return;
    set((s) => ({ draftById: { ...s.draftById, [id]: clone(a.data) } }));
  },

  updateDraft: (id, updater) => {
    set((s) => {
      const cur = s.draftById[id];
      if (cur === undefined) return {};
      const next = clone(cur);
      updater(next);
      return { draftById: { ...s.draftById, [id]: next } };
    });
  },

  cancelEdit: (id) => set((s) => ({ draftById: { ...s.draftById, [id]: undefined } })),

  async saveDraft(id, provenance) {
    const a = get().artifacts.find((x) => x.artifact_id === id);
    const d = get().draftById[id];
    if (!a || d === undefined) return "ok";

    const patch = JSON.stringify(a.data) === JSON.stringify(d)
      ? []
      : [{ op: "replace", path: "/", value: d }];

    if (!patch.length) {
      set((s) => ({ draftById: { ...s.draftById, [id]: undefined } }));
      return "ok";
    }
    const res = await get().patchArtifact(id, patch, provenance ?? { author: "ui", reason: "inline edit" });
    if (res === "ok") {
      await get().refreshArtifact(id);
      set((s) => ({ draftById: { ...s.draftById, [id]: undefined } }));
    }
    return res;
  },

  setQuery: (q) => set((s) => ({ filters: { ...s.filters, q } })),
  toggleKind: (k) =>
    set((s) => {
      const kinds = new Set(s.filters.kinds);
      kinds.has(k) ? kinds.delete(k) : kinds.add(k);
      return { filters: { ...s.filters, kinds } };
    }),

  filteredArtifacts() {
    const { artifacts, filters } = get();
    const q = filters.q.trim().toLowerCase();
    return artifacts.filter((a) => {
      if (filters.kinds.size && !filters.kinds.has(a.kind)) return false;
      if (!q) return true;
      const hay = `${a.name} ${a.kind}`.toLowerCase();
      return hay.includes(q);
    });
  },

  counts() {
    const A = get().artifacts;
    const byCategory: Record<string, number> = {};
    for (const a of A) {
      const cat = a.kind.startsWith("cam.") ? (a.kind.split(".")[1] ?? "other") : "other";
      byCategory[cat] = (byCategory[cat] ?? 0) + 1;
    }
    return { total: A.length, byCategory };
  },
}));

export const useRainaSelector = <T,>(sel: (s: RainaState) => T) => useRainaStore(useShallow(sel));
