/* eslint-disable @typescript-eslint/no-explicit-any */
import { create } from "zustand";
import { callHost } from "@/lib/host";
import type { WorkspaceDetail, Artifact } from "@/types/workspace";

type DetailStore = {
  loading: boolean;
  error?: string;
  detail?: WorkspaceDetail;
  artifacts: Artifact[];
  viewTab: "overview" | "artifacts" | "conversations" | "timeline";
  rightPane: "details" | "agent" | null;
  load: (id: string) => Promise<void>;
  setTab: (t: DetailStore["viewTab"]) => void;
  openRight: (p: DetailStore["rightPane"]) => void;
  clear: () => void;
};

export const useWorkspaceDetailStore = create<DetailStore>((set) => ({
  loading: false,
  artifacts: [],
  viewTab: "overview",
  rightPane: "details",
  async load(id) {
    set({ loading: true, error: undefined });
    try {
      const detail = await callHost<WorkspaceDetail>({ type: "workspace:get", payload: { id } });
      set({ detail, artifacts: detail.artifacts ?? [], loading: false });
    } catch (e: any) {
      set({ error: e?.message ?? "Failed to load workspace", loading: false });
    }
  },
  setTab: (t) => set({ viewTab: t }),
  openRight: (p) => set({ rightPane: p }),
  clear: () => set({ detail: undefined, artifacts: [], viewTab: "overview" }),
}));
