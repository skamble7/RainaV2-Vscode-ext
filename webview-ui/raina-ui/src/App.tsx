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

  // React to both generic bus events and dedicated step events
  useVSCodeMessages<any>((msg) => {
    const t = msg?.type;
    const p = msg?.payload ?? {};

    if (t === "runs:step") {
      // Directly apply step deltas into the store; no HTTP roundtrip.
      runs.applyStepEvent(p);
      return;
    }

    if (t === "runs:event") {
      // If this generic event is actually a step event, handle like above.
      const rk: string | undefined = p?.meta?.routing_key || p?.routing_key;
      if (typeof rk === "string" && rk.startsWith("raina.discovery.step")) {
        runs.applyStepEvent(p);
        return;
      }

      // Otherwise refresh the run snapshot for completion/summary updates.
      const runId =
        p.run_id ||
        p.id ||
        p?.data?.run_id ||
        p?.event?.run_id ||
        p?.result_summary?.run_id;

      if (typeof runId === "string" && runId.length > 0) {
        runs.refreshOne(runId);
      }
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
