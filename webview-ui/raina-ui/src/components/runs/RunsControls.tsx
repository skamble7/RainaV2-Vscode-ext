/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import type { DiscoveryRun } from "@/stores/useRainaStore";
import { callHost } from "@/lib/host";
import type { BaselineInfo } from "./utils";

type Props = {
  workspaceId: string;
  baseline: BaselineInfo;
  onBaselineRefresh: () => Promise<void> | void;
  selectedRunId: string | null;
};

export default function RunsControls({ workspaceId, baseline, onBaselineRefresh, selectedRunId }: Props) {
  const [runDetail, setRunDetail] = useState<DiscoveryRun | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const [mergeFSS, setMergeFSS] = useState(true);
  const [mergeAVC, setMergeAVC] = useState(false);
  const [mergePSS, setMergePSS] = useState(false);

  useEffect(() => {
    setRunDetail(null);
    if (!selectedRunId) return;
    (async () => {
      try {
        const full = await callHost<DiscoveryRun>({ type: "runs:get", payload: { runId: selectedRunId } });
        setRunDetail(full);
      } catch {
        setRunDetail(null);
      }
    })();
  }, [selectedRunId]);

  function flash(kind: "ok" | "err", text: string) {
    setMsg({ kind, text });
    setTimeout(() => setMsg(null), 3500);
  }

  async function promote() {
    if (!selectedRunId || !runDetail) {
      flash("err", "Select a run first.");
      return;
    }
    const inputs = (runDetail as any).inputs;
    if (!inputs) {
      flash("err", "Selected run has no inputs.");
      return;
    }
    try {
      setBusy(true);
      await callHost({
        type: "baseline:set",
        payload: {
          workspaceId,
          inputs,
          ifAbsentOnly: false,
          expectedVersion: baseline.version ?? undefined,
        },
      });
      await onBaselineRefresh();
      flash("ok", "Baseline promoted from run.");
    } catch (e: any) {
      flash("err", e?.message ?? "Failed to promote baseline");
    } finally {
      setBusy(false);
    }
  }

  async function merge() {
    if (!selectedRunId || !runDetail) {
      flash("err", "Select a run first.");
      return;
    }
    const diff: any = (runDetail as any).input_diff;
    const inputs: any = (runDetail as any).inputs;
    if (!inputs || !diff) {
      flash("err", "Run inputs or diff not available yet.");
      return;
    }

    let fssStoriesUpsert: any[] | undefined = undefined;
    if (mergeFSS) {
      const addKeys: string[] = diff?.fss?.added_keys ?? [];
      const updKeys: string[] = (diff?.fss?.updated ?? []).map((u: any) => u?.key).filter(Boolean);
      const keys = new Set<string>([...addKeys, ...updKeys]);
      const stories: any[] = inputs?.fss?.stories ?? [];
      fssStoriesUpsert = stories.filter((s: any) => keys.has(s?.key));
    }

    const avc = mergeAVC ? inputs.avc : undefined;
    const pss = mergePSS ? inputs.pss : undefined;

    if (!avc && !pss && (!fssStoriesUpsert || fssStoriesUpsert.length === 0)) {
      flash("err", "Nothing to merge. Select at least one option.");
      return;
    }

    try {
      setBusy(true);
      await callHost({
        type: "baseline:patch",
        payload: {
          workspaceId,
          avc,
          pss,
          fssStoriesUpsert,
          expectedVersion: baseline.version ?? undefined,
        },
      });
      await onBaselineRefresh();
      flash("ok", "Baseline merged.");
    } catch (e: any) {
      flash("err", e?.message ?? "Failed to merge baseline");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-4 space-y-4">
      {/* Baseline summary */}
      <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <KV label="Version" value={baseline.version ?? "N/A"} />
          <KV label="Fingerprint" value={baseline.fingerprint ?? "N/A"} mono truncate />
          <KV label="Last Promoted Run" value={baseline.last_promoted_run_id ?? "N/A"} mono truncate />
        </div>
        {msg && (
          <div
            className={`mt-3 rounded-md px-2 py-1 text-xs ${
              msg.kind === "ok" ? "bg-emerald-600/15 text-emerald-300" : "bg-red-600/15 text-red-300"
            }`}
          >
            {msg.text}
          </div>
        )}
      </div>

      {/* Promote */}
      <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-3">
        <RowHeader title="Promote to Baseline" right={selectedRunId || "Select a run"} />
        <div className="mt-2 text-xs text-neutral-400">
          Replace the baseline with the selected run’s full <span className="font-mono">inputs</span>.
        </div>
        <div className="mt-3">
          <Button size="sm" onClick={promote} disabled={!selectedRunId || busy} title={!selectedRunId ? "Select a run first" : ""}>
            Promote
          </Button>
        </div>
      </div>

      {/* Merge */}
      <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-3">
        <RowHeader title="Merge from Run" right={selectedRunId || "Select a run"} />
        <div className="mt-2 text-xs text-neutral-400">
          Use the run’s <span className="font-mono">input_diff</span> to upsert changed bits.
        </div>
        <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
          <label className="flex items-center gap-2">
            <Checkbox checked={mergeFSS} onCheckedChange={(v) => setMergeFSS(Boolean(v))} /> Upsert FSS stories (added + updated)
          </label>
          <label className="flex items-center gap-2">
            <Checkbox checked={mergeAVC} onCheckedChange={(v) => setMergeAVC(Boolean(v))} /> Replace AVC
          </label>
          <label className="flex items-center gap-2">
            <Checkbox checked={mergePSS} onCheckedChange={(v) => setMergePSS(Boolean(v))} /> Replace PSS
          </label>
        </div>
        <div className="mt-3">
          <Button size="sm" onClick={merge} disabled={!selectedRunId || busy} title={!selectedRunId ? "Select a run first" : ""}>
            Merge
          </Button>
        </div>
      </div>
    </div>
  );
}

function KV({ label, value, mono, truncate }: { label: string; value: React.ReactNode; mono?: boolean; truncate?: boolean }) {
  return (
    <div className="text-xs text-neutral-400">
      <div className="uppercase tracking-wide">{label}</div>
      <div className={["mt-1", mono ? "font-mono text-neutral-200" : "text-neutral-200", truncate ? "truncate" : ""].join(" ")} title={String(value)}>
        {value}
      </div>
    </div>
  );
}

function RowHeader({ title, right }: { title: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <div className="text-sm font-medium text-neutral-200">{title}</div>
      <div className="text-[11px] text-neutral-400">{right}</div>
    </div>
  );
}
