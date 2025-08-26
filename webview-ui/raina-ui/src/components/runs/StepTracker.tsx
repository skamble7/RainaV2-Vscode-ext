/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-explicit-any */
//webview-ui/raina-ui/src/components/runs/StepTracker.tsx
import React, { useEffect, useMemo, useState } from "react";
import { CheckCircle2, CircleDot, Circle, XCircle, Clock, ChevronDown, ChevronUp } from "lucide-react";
import { useRunsStore } from "@/stores/useRunsStore";
import { callHost } from "@/lib/host";

type Props = {
  runId?: string | null;
  className?: string;
  /** Optional overrides; defaults to svc-micro/v1.2 */
  packKey?: string;
  packVersion?: string;
  /** Allow collapse */
  collapsible?: boolean;
};

function StatusIcon({ s }: { s: "pending" | "started" | "completed" | "failed" }) {
  const common = "inline-block";
  switch (s) {
    case "completed": return <CheckCircle2 className={common} size={16} />;
    case "failed": return <XCircle className={common} size={16} />;
    case "started": return <CircleDot className={common} size={16} />;
    default: return <Circle className={common} size={16} />;
  }
}

export default function StepTracker({ runId, className, packKey = "svc-micro", packVersion = "v1.2", collapsible = true }: Props) {
  const run = useRunsStore(s => (runId ? s.items.find(r => r.run_id === runId) : undefined));
  const seed = useRunsStore(s => s.seedLiveSteps);

  // Persisted open/closed
  const [open, setOpen] = useState<boolean>(() => {
    try { return localStorage.getItem("raina:runs:stepsOpen") !== "0"; } catch { return true; }
  });
  useEffect(() => {
    try { localStorage.setItem("raina:runs:stepsOpen", open ? "1" : "0"); } catch { /* ignore */ }
  }, [open]);

  // Preload known steps from capability-registry once per run
  useEffect(() => {
    (async () => {
      if (!run?.run_id || !run.playbook_id) return;

      const hasAny = run.live_steps && Object.keys(run.live_steps).length > 0;
      if (hasAny) return; // already seeded or events arrived

      try {
        const pack = await callHost<any>({
          type: "capability:pack:get",
          payload: { key: packKey, version: packVersion },
        });

        const caps: any[] = Array.isArray(pack?.capabilities) ? pack.capabilities : [];
        const capById = new Map<string, any>(caps.map(c => [c.id, c]));
        const pb = (Array.isArray(pack?.playbooks) ? pack.playbooks : []).find((p: any) => p.id === run.playbook_id);
        const steps: any[] = Array.isArray(pb?.steps) ? pb.steps : [];

        const metas = steps.map((s) => {
          const c = capById.get(s.capability_id) || {};
          return {
            id: s.id,
            capability_id: s.capability_id,
            name: c.name || s.id,
            produces_kinds: Array.isArray(c.produces_kinds) ? c.produces_kinds : [],
          };
        });

        seed(run.run_id, metas, { markDoneIfRunCompleted: run.status === "completed" });
      } catch {
        // Silent; tracker will still update as events arrive
      }
    })();
  }, [run?.run_id, run?.playbook_id, run?.status, packKey, packVersion, seed]);

  // Build a sorted list from live_steps
  const items = useMemo(() => {
    const map = run?.live_steps || {};
    const arr = Object.values(map) as any[];
    arr.sort((a, b) => {
      const sa = a.started_at ? Date.parse(a.started_at) : 0;
      const sb = b.started_at ? Date.parse(b.started_at) : 0;
      if (sa !== sb) return sa - sb;
      const ia = a?.step?.id || a?.id || "";
      const ib = b?.step?.id || b?.id || "";
      return ia.localeCompare(ib);
    });
    return arr.map((e) => ({
      id: e?.step?.id || e?.id || "step",
      name: e?.step?.name || e?.name,
      capability_id: e?.step?.capability_id || e?.capability_id,
      status: (e?.status as "pending" | "started" | "completed" | "failed") ?? "pending",
      duration_s: e?.duration_s,
      produces_kinds: e?.produces_kinds,
      error: e?.error,
    }));
  }, [run?.live_steps]);

  const total = items.length;
  const done = items.filter(s => s.status === "completed").length;
  const failed = items.filter(s => s.status === "failed").length;
  const running = items.filter(s => s.status === "started").length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  const headerRight =
    failed > 0
      ? `${done}/${total} done · ${failed} failed`
      : `${done}/${total} done${running ? ` · ${running} running` : ""}`;

  return (
    <div className={["rounded-2xl border border-neutral-800 bg-neutral-900/60", className || ""].join(" ")}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800">
        <div className="text-sm font-medium text-neutral-200">
          Playbook Steps
          {run?.status && (
            <span className="ml-2 rounded-full border border-neutral-700 px-2 py-[2px] text-[11px] text-neutral-300 capitalize">
              {run.status}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="text-xs text-neutral-400">{headerRight}</div>
          {collapsible && (
            <button
              className="text-neutral-300 hover:text-white"
              title={open ? "Hide steps" : "Show steps"}
              onClick={() => setOpen(v => !v)}
            >
              {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          )}
        </div>
      </div>

      {!open ? null : (
        <>
          {/* Progress */}
          <div className="px-4 pt-3">
            <div className="h-2 w-full rounded bg-neutral-800 overflow-hidden">
              <div className="h-2 bg-blue-500 transition-all" style={{ width: `${pct}%` }} />
            </div>
            <div className="mt-1 text-[11px] text-neutral-500">{pct}%</div>
          </div>

          {/* Steps */}
          <ul className="px-2 py-2 space-y-1">
            {items.length === 0 ? (
              <li className="px-2 py-3 text-sm text-neutral-400">Waiting for steps…</li>
            ) : (
              items.map((s) => {
                const subtle =
                  s.status === "pending" ? "text-neutral-400" :
                  s.status === "started" ? "text-blue-300" :
                  s.status === "completed" ? "text-green-300" :
                  "text-red-300";

                const rowBorder =
                  s.status === "failed" ? "border-red-800/60" :
                  s.status === "completed" ? "border-green-800/40" :
                  "border-neutral-800";

                return (
                  <li key={s.id} className={`px-3 py-2 rounded-xl border ${rowBorder} flex items-start gap-3`}>
                    <div className={subtle}><StatusIcon s={s.status} /></div>
                    <div className="min-w-0">
                      <div className="text-sm text-neutral-200 truncate">
                        {s.name || s.id}
                        {s.capability_id && (
                          <span className="ml-2 text-[11px] text-neutral-500">{s.capability_id}</span>
                        )}
                      </div>
                      <div className="mt-0.5 text-[11px] text-neutral-400 flex items-center gap-3">
                        <span className="capitalize">{s.status}</span>
                        {s.duration_s != null && (
                          <span className="flex items-center gap-1">
                            <Clock size={12} /> {typeof s.duration_s === "number" ? s.duration_s.toFixed(2) : s.duration_s}s
                          </span>
                        )}
                        {Array.isArray(s.produces_kinds) && s.produces_kinds.length > 0 && (
                          <span className="truncate">→ {s.produces_kinds.join(", ")}</span>
                        )}
                      </div>
                      {s.error && <div className="mt-1 text-[12px] text-red-300/90">{s.error}</div>}
                    </div>
                  </li>
                );
              })
            )}
          </ul>
        </>
      )}
    </div>
  );
}
