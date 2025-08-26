// webview-ui/raina-ui/src/bootstrapWs.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useRainaStore } from "@/stores/useRainaStore";

export function bootstrapWsBridge() {
  // Avoid attaching multiple listeners during HMR
  const FLAG = "__raina_ws_bootstrapped__";
  if ((window as any)[FLAG]) return;
  (window as any)[FLAG] = true;

  window.addEventListener("message", (event: MessageEvent) => {
    const msg = event.data;
    if (!msg || typeof msg !== "object") return;
    if (msg.type !== "ws.event") return;

    const payload = msg.payload;
    if (!payload || typeof payload !== "object") return;

    const { applyStepEvent, refreshRun } = useRainaStore.getState();

    // Step events come over the same channel with a routing key
    const rk: string | undefined = payload?.meta?.routing_key || payload?.routing_key;
    if (typeof rk === "string" && rk.startsWith("raina.discovery.step")) {
      applyStepEvent(payload);
      return;
    }

    // Otherwise, if we can extract a run id, refresh that run snapshot
    const runId: string | undefined =
      payload.run_id ||
      payload.id ||
      payload?.data?.run_id ||
      payload?.event?.run_id ||
      payload?.result_summary?.run_id;

    if (typeof runId === "string" && runId.length > 0) {
      refreshRun(runId);
    }
  });
}
