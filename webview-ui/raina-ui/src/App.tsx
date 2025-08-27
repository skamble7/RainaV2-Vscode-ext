/* eslint-disable @typescript-eslint/no-explicit-any */
import WorkspaceLanding from "@/components/workspace/WorkspaceLanding";
import WorkspaceDetail from "@/components/workspace-detail/WorkspaceDetail";
import { useRainaStore } from "@/stores/useRainaStore";
import { useVSCodeMessages } from "./lib/vscode";

export default function App() {
  const {
    currentWorkspaceId,
    switchWorkspace,
    applyStepEvent,
    refreshRun,
  } = useRainaStore();

  // React to both generic bus events and dedicated step events
  useVSCodeMessages<any>((msg) => {
    const t = msg?.type;
    const p = msg?.payload ?? {};
    
    if (t === "runs:step") {
      // Directly apply step deltas into the store; no HTTP roundtrip.
      applyStepEvent(p);
      return;
    }

    if (t === "runs:event") {
      // If this generic event is actually a step event, handle like above.
      const rk: string | undefined = p?.meta?.routing_key || p?.routing_key;
      if (typeof rk === "string" && rk.startsWith("raina.discovery.step")) {
        applyStepEvent(p);
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
        refreshRun(runId);
      }
    }
  }, [applyStepEvent, refreshRun]);

  return (
    <div className="min-h-screen w-screen bg-neutral-950 text-neutral-100">
      {currentWorkspaceId ? (
        <WorkspaceDetail
          workspaceId={currentWorkspaceId}
          onBack={() => switchWorkspace(undefined)}
        />
      ) : (
        <WorkspaceLanding />
      )}
    </div>
  );
}
