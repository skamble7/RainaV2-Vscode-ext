/* eslint-disable @typescript-eslint/no-explicit-any */
import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { callHost } from "@/lib/host";

export type GlobalCapability = {
  id: string;
  name: string;
  description?: string;
  tags?: string[];
  parameters_schema?: any;
  produces_kinds?: string[];
  agent?: any;
};

export type PlaybookStep = {
  id: string;
  name?: string;
  description?: string;
  capability_id: string;
  params?: any;
};

export type Playbook = {
  id: string;
  name?: string;
  description?: string;
  steps: PlaybookStep[];
};

export type CapabilityPack = {
  _id?: string;
  key: string;
  version: string;
  title: string;
  description?: string;
  capability_ids: string[];
  capabilities?: Array<{
    id: string;
    name: string;
    description?: string;
    tags?: string[];
    produces_kinds?: string[];
    parameters_schema?: any;
    agent?: any;
  }>;
  playbooks: Playbook[];
  created_at?: string;
  updated_at?: string;
};

type State = {
  loading: boolean;
  error?: string | null;

  // listing
  q: string;
  packs: CapabilityPack[];
  count: number;

  // capabilities (global registry)
  caps: GlobalCapability[];
  capsLoaded: boolean;

  // selection / editing
  selected?: { key: string; version: string } | null;
  selectedPack?: CapabilityPack | null;

  // actions
  setQ: (q: string) => void;
  loadCaps: () => Promise<void>;
  loadPacks: (opts?: { key?: string; q?: string; limit?: number; offset?: number }) => Promise<void>;
  selectPack: (key: string, version: string) => Promise<void>;
  clearSelection: () => void;

  createPack: (body: Omit<CapabilityPack, "_id" | "created_at" | "updated_at" | "capabilities">) => Promise<void>;
  updatePack: (key: string, version: string, patch: Partial<CapabilityPack>) => Promise<void>;
  deletePack: (key: string, version: string) => Promise<void>;

  setPackCapabilities: (key: string, version: string, capability_ids: string[]) => Promise<void>;
  addPlaybook: (key: string, version: string, pb: Playbook) => Promise<void>;
  removePlaybook: (key: string, version: string, playbook_id: string) => Promise<void>;
  reorderSteps: (key: string, version: string, playbook_id: string, order: string[]) => Promise<void>;
};

export const useCapabilityStore = create<State>((set, get) => ({
  loading: false,
  error: null,

  q: "",
  packs: [],
  count: 0,

  caps: [],
  capsLoaded: false,

  selected: null,
  selectedPack: null,

  setQ: (q) => set({ q }),

  async loadCaps() {
    if (get().capsLoaded) return;
    try {
      set({ loading: true, error: null });
      const res = await callHost<{ items: GlobalCapability[]; count: number }>({
        type: "capability:list",
        payload: { limit: 200, offset: 0 },
      });
      set({ caps: res?.items ?? [], capsLoaded: true, loading: false });
    } catch (e: any) {
      set({ error: e?.message ?? "Failed to load capabilities", loading: false });
    }
  },

  async loadPacks(opts) {
    try {
      set({ loading: true, error: null });
      const res = await callHost<any>({
        type: "capability:pack:list",
        payload: { key: opts?.key, q: opts?.q ?? get().q, limit: 50, offset: 0 },
      });
      set({ packs: res ?? [], count: Array.isArray(res) ? res.length : (res?.count ?? 0), loading: false });
    } catch (e: any) {
      set({ error: e?.message ?? "Failed to load packs", loading: false });
    }
  },

  async selectPack(key, version) {
    try {
      set({ loading: true, error: null, selected: { key, version } });
      const pack = await callHost<CapabilityPack>({ type: "capability:pack:get", payload: { key, version } });
      set({ selectedPack: pack, loading: false });
    } catch (e: any) {
      set({ error: e?.message ?? "Failed to load pack", loading: false });
    }
  },

  clearSelection: () => set({ selected: null, selectedPack: null }),

  async createPack(body) {
    try {
      set({ loading: true, error: null });
      await callHost<CapabilityPack>({ type: "capability:pack:create", payload: body as any });
      await get().loadPacks();
      set({ loading: false });
    } catch (e: any) {
      set({ error: e?.message ?? "Failed to create pack", loading: false });
    }
  },

  async updatePack(key, version, patch) {
    try {
      set({ loading: true, error: null });
      const up = await callHost<CapabilityPack>({
        type: "capability:pack:update",
        payload: { key, version, patch },
      });
      set({ selectedPack: up, loading: false });
      await get().loadPacks();
    } catch (e: any) {
      set({ error: e?.message ?? "Failed to update pack", loading: false });
    }
  },

  async deletePack(key, version) {
    try {
      set({ loading: true, error: null });
      await callHost({ type: "capability:pack:delete", payload: { key, version } });
      set({ loading: false });
      await get().loadPacks();
      if (get().selected?.key === key && get().selected?.version === version) {
        set({ selected: null, selectedPack: null });
      }
    } catch (e: any) {
      set({ error: e?.message ?? "Failed to delete pack", loading: false });
    }
  },

  async setPackCapabilities(key, version, capability_ids) {
    try {
      set({ loading: true, error: null });
      const up = await callHost<CapabilityPack>({
        type: "capability:pack:setCaps",
        payload: { key, version, capability_ids },
      });
      set({ selectedPack: up, loading: false });
    } catch (e: any) {
      set({ error: e?.message ?? "Failed to set capability IDs", loading: false });
    }
  },

  async addPlaybook(key, version, pb) {
    try {
      set({ loading: true, error: null });
      const up = await callHost<CapabilityPack>({
        type: "capability:pack:addPlaybook",
        payload: { key, version, playbook: pb },
      });
      set({ selectedPack: up, loading: false });
    } catch (e: any) {
      set({ error: e?.message ?? "Failed to add playbook", loading: false });
    }
  },

  async removePlaybook(key, version, playbook_id) {
    try {
      set({ loading: true, error: null });
      const up = await callHost<CapabilityPack>({
        type: "capability:pack:removePlaybook",
        payload: { key, version, playbook_id },
      });
      set({ selectedPack: up, loading: false });
    } catch (e: any) {
      set({ error: e?.message ?? "Failed to remove playbook", loading: false });
    }
  },

  async reorderSteps(key, version, playbook_id, order) {
    try {
      set({ loading: true, error: null });
      const up = await callHost<CapabilityPack>({
        type: "capability:pack:reorderSteps",
        payload: { key, version, playbook_id, order },
      });
      set({ selectedPack: up, loading: false });
    } catch (e: any) {
      set({ error: e?.message ?? "Failed to reorder steps", loading: false });
    }
  },
}));

export const useCapabilitySelector = <T,>(sel: (s: State) => T) =>
  useCapabilityStore(useShallow(sel));
