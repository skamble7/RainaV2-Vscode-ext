// webview-ui/raina-ui/src/bootstrapWs.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useStepEventsStore } from "@/stores/useStepEventsStore";

export function bootstrapWsBridge() {
  const ingest = useStepEventsStore.getState().ingestWsEvent;

  window.addEventListener("message", (event: MessageEvent) => {
    const msg = event.data;
    if (!msg || typeof msg !== "object") return;
    if (msg.type === "ws.event") {
      ingest(msg.payload);
    }
  });
}
