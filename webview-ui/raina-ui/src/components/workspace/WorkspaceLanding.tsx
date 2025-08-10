// src/components/workspace/WorkspaceLanding.tsx
import { useEffect } from "react";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import ViewToggle from "./ViewToggle";
import NewWorkspaceDrawer from "./NewWorkspaceDrawer";
import WorkspaceCard from "./WorkspaceCard";
import { Separator } from "@/components/ui/separator";

export default function WorkspaceLanding() {
  const { load, loading, error, workspaces, view } = useWorkspaceStore();

  useEffect(() => {
    load();
  }, [load]);

  // later: if selectedWorkspaceId -> render <WorkspaceDetail />
  return (
    <div className="h-full w-full p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Your Workspaces</h2>
        <div className="flex items-center gap-2">
          <ViewToggle />
          <NewWorkspaceDrawer />
        </div>
      </div>

      <Separator className="my-4 opacity-30" />

      {error && <div className="text-red-400 text-sm mb-3">{error}</div>}

      {loading && workspaces.length === 0 ? (
        <div className="text-neutral-400 text-sm">Loading…</div>
      ) : workspaces.length === 0 ? (
        <div className="text-neutral-400 text-sm">No workspaces yet. Create your first one.</div>
      ) : view === "grid" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {workspaces.map((w) => (
            <WorkspaceCard key={w.id} workspace={w} variant="grid" />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {workspaces.map((w) => (
            <WorkspaceCard key={w.id} workspace={w} variant="list" />
          ))}
        </div>
      )}
    </div>
  );
}
