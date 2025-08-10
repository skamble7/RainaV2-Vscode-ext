// src/App.tsx
import WorkspaceLanding from "@/components/workspace/WorkspaceLanding";
import WorkspaceDetail from "@/components/workspace-detail/WorkspaceDetail";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";

export default function App() {
  const { selectedWorkspaceId, select } = useWorkspaceStore();

  console.log("[App] selectedWorkspaceId =", selectedWorkspaceId);

  return (
    <div className="min-h-screen w-screen bg-neutral-950 text-neutral-100">
      {selectedWorkspaceId ? (
        <WorkspaceDetail
          workspaceId={selectedWorkspaceId}
          onBack={() => {
            console.log("[App] Back button clicked — clearing selection");
            select(undefined);
          }}
        />
      ) : (
        <WorkspaceLanding />
      )}
    </div>
  );
}
