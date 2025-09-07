/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState, useCallback } from "react";
import { useRainaStore } from "@/stores/useRainaStore";
import { callHost } from "@/lib/host";
import ViewToggle from "./ViewToggle";
import NewWorkspaceDrawer from "./NewWorkspaceDrawer";
import WorkspaceCard from "./WorkspaceCard";
import SettingsPanel from "./SettingsPanel";
import { Separator } from "@/components/ui/separator";
import WorkspaceDetail from "@/components/workspace-detail/WorkspaceDetail";
import CapabilityPacksManager from "@/components/capability/CapabilityPacksManager";

type WorkspaceListItem = {
  id: string;
  name: string;
  description?: string | null;
  created_at: string;
  updated_at: string;
};

export default function WorkspaceLanding() {
  const currentWorkspaceId = useRainaStore((s) => s.currentWorkspaceId);
  const switchWorkspace = useRainaStore((s) => s.switchWorkspace);

  // NEW: top-level tabs
  const [pane, setPane] = useState<"workspaces" | "capabilityPacks">("workspaces");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [workspaces, setWorkspaces] = useState<WorkspaceListItem[]>([]);

  const [view, setView] = useState<"grid" | "list">(() => {
    try { return (localStorage.getItem("raina:workspaces:view") as "grid" | "list") || "grid"; }
    catch { return "grid"; }
  });
  useEffect(() => {
    try { localStorage.setItem("raina:workspaces:view", view); } catch { /* empty */ }
  }, [view]);

  const loadWorkspaces = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const raw = await callHost<any>({ type: "workspace:list" });
      const toStr = (v: any) => (v == null ? "" : String(v));

      const items: any[] = Array.isArray(raw) ? raw : (raw?.items ?? []);
      const normalized: WorkspaceListItem[] = items
        .map((w) => {
          const id = w?.id ?? w?._id ?? w?.workspace_id ?? w?.workspace?._id;
          if (!id) return null;
          return {
            id: String(id),
            name: w?.name ?? w?.workspace?.name ?? "Untitled workspace",
            description: w?.description ?? w?.workspace?.description ?? null,
            created_at: toStr(w?.created_at ?? w?.workspace?.created_at),
            updated_at: toStr(w?.updated_at ?? w?.workspace?.updated_at),
          };
        })
        .filter(Boolean) as WorkspaceListItem[];

      normalized.sort((a, b) => b.updated_at.localeCompare(a.updated_at)); // newest first
      setWorkspaces(normalized);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load workspaces");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadWorkspaces(); }, [loadWorkspaces]);

  const landingBody = useMemo(() => {
    if (loading && workspaces.length === 0) return <div className="text-neutral-400 text-sm">Loading…</div>;
    if (error) return <div className="text-red-400 text-sm mb-3">{error}</div>;
    if (workspaces.length === 0) return <div className="text-neutral-400 text-sm">No workspaces yet. Create your first one.</div>;

    return view === "grid" ? (
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {workspaces.map((w) => <WorkspaceCard key={w.id} workspace={w} variant="grid" />)}
      </div>
    ) : (
      <div className="flex flex-col gap-3">
        {workspaces.map((w) => <WorkspaceCard key={w.id} workspace={w} variant="list" />)}
      </div>
    );
  }, [loading, error, workspaces, view]);

  if (pane === "capabilityPacks") {
    return (
      <div className="h-full w-full">
        <div className="flex items-center justify-between p-6 pb-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setPane("workspaces")}
              className="text-sm text-neutral-400 hover:text-neutral-200"
            >
              ← Back to Workspaces
            </button>
          </div>
        </div>
        <CapabilityPacksManager />
      </div>
    );
  }

  return (
    <div className="h-full w-full">
      {currentWorkspaceId ? (
        <WorkspaceDetail
          workspaceId={currentWorkspaceId}
          onBack={() => switchWorkspace(undefined)}
        />
      ) : (
        <div className="h-full w-full p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Your Workspaces</h2>
            <div className="flex items-center gap-2">
              <ViewToggle view={view} onChange={setView} />
              {/* ⚙️ Settings → open Capability Packs tab */}
              <SettingsPanel
                onOpenCam={() => { /* reserved for CAM manager later */ }}
                onOpenCapabilityPack={() => setPane("capabilityPacks")}
              />
              <NewWorkspaceDrawer onCreated={() => loadWorkspaces()} />
            </div>
          </div>

          <Separator className="my-4 opacity-30" />
          {landingBody}
        </div>
      )}
    </div>
  );
}
