/* eslint-disable @typescript-eslint/no-explicit-any */
// src/App.tsx
import WorkspaceLanding from "@/components/workspace/WorkspaceLanding";
import WorkspaceDetail from "@/components/workspace-detail/WorkspaceDetail";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import { useRunsStore } from "@/stores/useRunsStore";
import { useVSCodeMessages } from "./lib/vscode";

export default function App() {
  const { selectedWorkspaceId, select } = useWorkspaceStore();
  const runs = useRunsStore();

  // NEW: react to run events coming from the extension (WS → extension → webview)
  useVSCodeMessages<any>((msg) => {
    if (msg?.type !== "runs:event") return;

    // Be defensive about event shape; try to find a run_id anywhere reasonable.
    const p = msg.payload ?? {};
    const runId =
      p.run_id ||
      p.id ||
      p?.data?.run_id ||
      p?.event?.run_id ||
      p?.result_summary?.run_id;

    if (typeof runId === "string" && runId.length > 0) {
      // Ask backend for the latest run snapshot; store will upsert & normalize status.
      runs.refreshOne(runId);
    }
  }, [runs]);

  return (
    <div className="min-h-screen w-screen bg-neutral-950 text-neutral-100">
      {selectedWorkspaceId ? (
        <WorkspaceDetail
          workspaceId={selectedWorkspaceId}
          onBack={() => {
            select(undefined);
          }}
        />
      ) : (
        <WorkspaceLanding />
      )}
    </div>
  );
}
