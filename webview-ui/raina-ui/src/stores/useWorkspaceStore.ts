// src/services/useWorkspaceStore.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
// webview-ui/raina-ui/src/stores/useWorkspaceStore.ts
import { create } from "zustand";
import { callHost } from "@/lib/host";

export type Workspace = {
    id: string;
    name: string;
    description?: string | null;
    created_by?: string | null;
    created_at: string;
    updated_at: string;
};

type Store = {
    loading: boolean;
    error?: string;
    workspaces: Workspace[];
    view: "grid" | "list";
    selectedWorkspaceId?: string;
    load: () => Promise<void>;
    create: (p: { name: string; description?: string; created_by?: string }) => Promise<void>;
    setView: (v: "grid" | "list") => void;
    select: (id?: string) => void;
};

export const useWorkspaceStore = create<Store>((set, get) => ({
    loading: false,
    workspaces: [],
    view: "grid",
    selectedWorkspaceId: undefined,
    setView: (v) => set({ view: v }),

    load: async () => {
        set({ loading: true, error: undefined });
        try {
            const list = await callHost<Workspace[]>({ type: "workspace:list" });
            set({ workspaces: list, loading: false });
        } catch (e: any) {
            set({ error: e?.message ?? "Failed to load", loading: false });
        }
    },

    create: async (p) => {
        set({ loading: true, error: undefined });
        try {
            const ws = await callHost<Workspace>({ type: "workspace:create", payload: p });
            set({ workspaces: [ws, ...get().workspaces], loading: false });
        } catch (e: any) {
            set({ error: e?.message ?? "Failed to create", loading: false });
        }
    },
    select: (id) => set({ selectedWorkspaceId: id }),
}));
