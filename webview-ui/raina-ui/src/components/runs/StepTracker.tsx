/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable prefer-const */
/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-explicit-any */
// webview-ui/raina-ui/src/components/runs/StepTracker.tsx
import React, { useEffect, useMemo, useState } from "react";
import { CheckCircle2, CircleDot, Circle, XCircle, Clock, ChevronDown, ChevronUp } from "lucide-react";
import { useRainaStore } from "@/stores/useRainaStore";
import { callHost } from "@/lib/host";

type Props = {
  runId?: string | null;
  className?: string;
  /** Optional: if you really want to force a specific pack for all runs, pass these. Otherwise we derive from the run. */
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

/** Best-effort extraction of (pack_key, pack_version) from a run snapshot */
function derivePackFromRun(run: any): { key?: string; version?: string } {
  // Prefer explicit options on the run (how we start them)
  const pk = run?.options?.pack_key;
  const pv = run?.options?.pack_version;

  // Fallbacks: occasionally provenance may carry these
  const fk = run?.provenance?.pack_key;
  const fv = run?.provenance?.pack_version;

  return { key: pk ?? fk, version: pv ?? fv };
}

export default function StepTracker({
  runId,
  className,
  packKey: forcedPackKey,
  packVersion: forcedPackVersion,
  collapsible = true,
}: Props) {
  // Live run (from store list)
  const run = useRainaStore((s) => (runId ? s.runs.find((r) => r.run_id === runId) : undefined));
  const seed = useRainaStore((s) => s.seedLiveSteps);
  const defaults = useRainaStore((s) => s.capabilityDefaults);

  // We need the concrete playbook *and* the pack (key/version) for THIS run
  const [pbId, setPbId] = useState<string | null>(null);
  const [pack, setPack] = useState<{ key: string; version: string } | null>(null);

  // Fetch a full run snapshot once (runs:list can be sparse) and derive pb + pack from it.
  useEffect(() => {
    let isCancelled = false;

    (async () => {
      if (!runId) {
        setPbId(null);
        setPack(null);
        return;
      }

      try {
        // Prefer what we already have in the store if present
        let pb = run?.playbook_id ?? null;
        let derived = derivePackFromRun(run);

        if (!pb || !derived.key || !derived.version) {
          const full = await callHost<any>({ type: "runs:get", payload: { runId } });
          pb = pb || full?.playbook_id || null;
          const fromFull = derivePackFromRun(full);
          derived = {
            key: derived.key ?? fromFull.key,
            version: derived.version ?? fromFull.version,
          };
        }

        // Final fallbacks: force > capabilityDefaults > null
        const finalKey =
          forcedPackKey ??
          derived.key ??
          defaults.pack_key ??
          null;
        const finalVer =
          forcedPackVersion ??
          derived.version ??
          defaults.pack_version ??
          null;

        if (!isCancelled) {
          setPbId(pb);
          setPack(finalKey && finalVer ? { key: finalKey, version: finalVer } : null);
        }
      } catch {
        if (!isCancelled) {
          setPbId(run?.playbook_id ?? null);
          const d = derivePackFromRun(run);
          const finalKey = forcedPackKey ?? d.key ?? defaults.pack_key ?? null;
          const finalVer = forcedPackVersion ?? d.version ?? defaults.pack_version ?? null;
          setPack(finalKey && finalVer ? { key: finalKey, version: finalVer } : null);
        }
      }
    })();

    return () => { isCancelled = true; };
  }, [runId, run?.playbook_id, forcedPackKey, forcedPackVersion, defaults.pack_key, defaults.pack_version]);

  // Persisted open/closed
  const [open, setOpen] = useState<boolean>(() => {
    try { return localStorage.getItem("raina:runs:stepsOpen") !== "0"; } catch { return true; }
  });
  useEffect(() => {
    try { localStorage.setItem("raina:runs:stepsOpen", open ? "1" : "0"); } catch { /* noop */ }
  }, [open]);

  // Seed live steps for the run from the *run's* playbook, using the *run's* pack
  useEffect(() => {
    let cancelled = false;

    async function seedFromRunPack(_pbId: string, _pack: { key: string; version: string }) {
      try {
        const packResp = await callHost<any>({
          type: "capability:pack:get",
          payload: { key: _pack.key, version: _pack.version },
        });

        const caps: any[] = Array.isArray(packResp?.capabilities) ? packResp.capabilities : [];
        const capById = new Map<string, any>(caps.map((c) => [c.id, c]));

        const pb = (Array.isArray(packResp?.playbooks) ? packResp.playbooks : []).find((p: any) => p.id === _pbId);
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

        if (!cancelled && metas.length && run?.run_id) {
          seed(run.run_id, metas, { markDoneIfRunCompleted: run.status === "completed" });
        }
      } catch (e) {
        console.debug("[StepTracker] pack/get failed", e);
      }
    }

    const needsSeed = !!run && (!run.live_steps || Object.keys(run.live_steps).length === 0);
    if (needsSeed && pbId && pack?.key && pack?.version) {
      seedFromRunPack(pbId, pack);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pbId, pack?.key, pack?.version, run?.run_id, run?.status, run?.live_steps, seed]);

  // Build items for display
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
          <div className="text-xs text-neutral-400">
            {done}/{total} done{failed ? ` · ${failed} failed` : running ? ` · ${running} running` : ""}
          </div>
          {collapsible && (
            <button
              className="text-neutral-300 hover:text-white"
              title={"Toggle"}
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
