/* eslint-disable @typescript-eslint/no-unused-expressions */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { create } from "zustand";
import { callHost } from "@/lib/host";
import type { WorkspaceDetail, Artifact } from "@/types/workspace";

export type ArtifactFilters = {
  q: string;
  kinds: Set<string>;     // e.g., "cam.document", "cam.sequence_diagram"
  docTypes: Set<string>;  // e.g., "event_catalog", "api_contracts", "nfr_matrix"
};

type Counts = {
  total: number;
  artifacts: number;
  events: number;
  apis: number;
  nfrs: number;
  topology: number;
  adrs: number;
  sequences: number;
};

type DetailStore = {
  // data
  loading: boolean;
  error?: string;
  detail?: WorkspaceDetail;
  artifacts: Artifact[];

  // ui
  tab: "overview" | "artifacts" | "conversations" | "timeline" | "runs";
  rightOpen: boolean;
  rightMode: "details" | "agent";
  selectedArtifactId?: string;
  filters: ArtifactFilters;

  // drafts (inline editing)
  draftById: Record<string, any | undefined>;
  isDirty: (id: string) => boolean;
  startEdit: (id: string) => void;
  updateDraft: (id: string, updater: (draft: any) => void) => void;
  cancelEdit: (id: string) => void;
  saveDraft: (id: string, provenance?: any) => Promise<"ok" | "conflict">;

  // etags per artifact
  etags: Record<string, string | undefined>;

  // lifecycle
  load: (workspaceId: string) => Promise<void>;
  clear: () => void;

  // tabs & panes
  setTab: (t: DetailStore["tab"]) => void;
  openRight: (mode?: "details" | "agent") => void;
  closeRight: () => void;

  // selection
  selectArtifact: (id?: string) => Promise<void>;

  // search/filters
  setQuery: (q: string) => void;
  toggleKind: (k: string) => void;
  toggleDocType: (d: string) => void;

  // workspace meta
  updateWorkspaceMeta: (patch: { name?: string; description?: string }) => Promise<void>;

  // artifact operations (ETag aware)
  refreshArtifact: (artifactId: string) => Promise<void>;
  patchArtifact: (artifactId: string, patch: any[], provenance?: any) => Promise<"ok" | "conflict">;
  replaceArtifact: (artifactId: string, dataPayload: any, provenance?: any) => Promise<"ok" | "conflict">;
  deleteArtifact: (artifactId: string) => Promise<void>;
  loadHistory: (artifactId: string) => Promise<any[]>;

  // derived helpers
  filteredArtifacts: () => Artifact[];
  counts: () => Counts;
};

const hasDocType = (a: Artifact, dt: string) => (a as any)?.data?.doc_type === dt;
const isADR = (a: Artifact) => hasDocType(a, "adr_index") || !!(a as any)?.data?.adrs;
const clone = <T,>(v: T): T =>
  typeof (globalThis as any).structuredClone === "function"
    ? (structuredClone as any)(v)
    : JSON.parse(JSON.stringify(v));

/** Very small diff → JSON Patch generator.
 * - Recurses objects; replaces arrays/primitive changes.
 * - Paths are relative to data root (backend expects that).
 */
function diffToPatch(before: any, after: any, basePath = ""): any[] {
  // primitive or array → replace if different
  const isObj = (x: any) => x && typeof x === "object" && !Array.isArray(x);
  if (!isObj(before) || !isObj(after)) {
    return JSON.stringify(before) === JSON.stringify(after)
      ? []
      : [{ op: "replace", path: basePath || "/", value: after }];
  }
  const ops: any[] = [];
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const k of keys) {
    const p = `${basePath}/${k}`;
    const b = (before as any)[k];
    const a = (after as any)[k];
    if (Array.isArray(b) || Array.isArray(a) || !isObj(b) || !isObj(a)) {
      if (JSON.stringify(b) !== JSON.stringify(a)) ops.push({ op: "replace", path: p, value: a });
    } else {
      ops.push(...diffToPatch(b, a, p));
    }
  }
  return ops;
}

export const useWorkspaceDetailStore = create<DetailStore>((set, get) => ({
  loading: false,
  artifacts: [],
  tab: "artifacts",
  rightOpen: false,
  rightMode: "details",
  filters: { q: "", kinds: new Set(), docTypes: new Set() },
  etags: {},
  draftById: {},

  async load(workspaceId) {
    set({ loading: true, error: undefined });
    try {
      const detail = await callHost<WorkspaceDetail>({ type: "workspace:get", payload: { id: workspaceId } });
      set({
        detail,
        artifacts: detail?.artifacts ?? [],
        loading: false,
        etags: {},     // reset; fetch per-artifact on demand
        draftById: {}, // clear drafts on load
      });
    } catch (e: any) {
      set({ error: e?.message ?? "Failed to load workspace detail", loading: false });
    }
  },

  clear: () =>
    set({
      loading: false,
      error: undefined,
      detail: undefined,
      artifacts: [],
      tab: "artifacts",
      rightOpen: false,
      rightMode: "details",
      selectedArtifactId: undefined,
      filters: { q: "", kinds: new Set(), docTypes: new Set() },
      etags: {},
      draftById: {},
    }),

  setTab: (t) => set({ tab: t }),
  openRight: (mode) => set({ rightOpen: true, rightMode: mode ?? "details" }),
  closeRight: () => set({ rightOpen: false }),

  // Selecting an artifact also refreshes it once to capture ETag
  async selectArtifact(id) {
    set({ selectedArtifactId: id });
    if (id) {
      set({ rightOpen: true, rightMode: "details" });
      try { await get().refreshArtifact(id); } catch { /* ignore initial refresh errors */ }
    }
  },

  setQuery: (q) => set((s) => ({ filters: { ...s.filters, q } })),
  toggleKind: (k) =>
    set((s) => {
      const kinds = new Set(s.filters.kinds);
      kinds.has(k) ? kinds.delete(k) : kinds.add(k);
      return { filters: { ...s.filters, kinds } };
    }),
  toggleDocType: (d) =>
    set((s) => {
      const docTypes = new Set(s.filters.docTypes);
      docTypes.has(d) ? docTypes.delete(d) : docTypes.add(d);
      return { filters: { ...s.filters, docTypes } };
    }),

  // ----- Draft/inline edit API -----
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

  cancelEdit: (id) =>
    set((s) => ({ draftById: { ...s.draftById, [id]: undefined } })),

  async saveDraft(id, provenance) {
    const a = get().artifacts.find((x) => x.artifact_id === id);
    const d = get().draftById[id];
    if (!a || d === undefined) return "ok";
    const patch = diffToPatch(a.data, d, ""); // paths are rooted at data
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

  // ----- Workspace meta -----
  async updateWorkspaceMeta(patch) {
    const id = get().detail?.workspace?._id;
    if (!id) return;
    await callHost({ type: "workspace:update", payload: { id, patch } });
    set((s) =>
      s.detail
        ? { detail: { ...s.detail, workspace: { ...s.detail.workspace, ...patch } } }
        : {}
    );
  },

  // ----- Artifact operations -----
  async refreshArtifact(artifactId) {
    const ws = get().detail?.workspace_id;
    if (!ws) return;
    const { data, etag } = await callHost<{ data: Artifact; etag?: string }>({
      type: "artifact:get",
      payload: { workspaceId: ws, artifactId },
    });
    set((s) => ({
      artifacts: s.artifacts.map((a) => (a.artifact_id === artifactId ? (data as any) : a)),
      etags: { ...s.etags, [artifactId]: etag },
    }));
  },

  async patchArtifact(artifactId, patch, provenance) {
    const ws = get().detail?.workspace_id;
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
      return "ok";
    } catch (e: any) {
      if (e?.message === "PRECONDITION_FAILED") return "conflict";
      throw e;
    }
  },

  async replaceArtifact(artifactId, dataPayload, provenance) {
    const ws = get().detail?.workspace_id;
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
      return "ok";
    } catch (e: any) {
      if (e?.message === "PRECONDITION_FAILED") return "conflict";
      throw e;
    }
  },

  async deleteArtifact(artifactId) {
    const ws = get().detail?.workspace_id;
    if (!ws) return;
    await callHost({ type: "artifact:delete", payload: { workspaceId: ws, artifactId } });
    set((s) => ({
      artifacts: s.artifacts.filter((a) => a.artifact_id !== artifactId),
      etags: Object.fromEntries(Object.entries(s.etags).filter(([k]) => k !== artifactId)),
      selectedArtifactId: s.selectedArtifactId === artifactId ? undefined : s.selectedArtifactId,
      rightOpen: s.selectedArtifactId === artifactId ? false : s.rightOpen,
      draftById: { ...s.draftById, [artifactId]: undefined },
    }));
  },

  async loadHistory(artifactId) {
    const ws = get().detail?.workspace_id;
    if (!ws) return [];
    return await callHost<any[]>({
      type: "artifact:history",
      payload: { workspaceId: ws, artifactId },
    });
  },

  // ----- Derived -----
  filteredArtifacts() {
    const { artifacts, filters } = get();
    const q = filters.q.trim().toLowerCase();

    return artifacts.filter((a) => {
      if (filters.kinds.size && !filters.kinds.has(a.kind)) return false;
      const dt = (a as any)?.data?.doc_type as string | undefined;
      if (filters.docTypes.size && (!dt || !filters.docTypes.has(dt))) return false;
      if (!q) return true;
      const hay = `${a.name} ${a.kind} ${dt ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  },

  counts() {
    const A = get().artifacts;
    return {
      total: A.length,
      artifacts: A.length,
      events: A.filter((a) => hasDocType(a, "event_catalog")).length,
      apis: A.filter((a) => hasDocType(a, "api_contracts")).length,
      nfrs: A.filter((a) => hasDocType(a, "nfr_matrix")).length,
      topology: A.filter((a) => hasDocType(a, "deployment_topology")).length,
      adrs: A.filter((a) => isADR(a)).length,
      sequences: A.filter((a) => a.kind === "cam.sequence_diagram").length,
    };
  },
}));
