/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { callHost } from "@/lib/host";
import type { DiscoveryRun } from "@/stores/useRainaStore";
import { type Artifact, type BaselineInfo, computeDiff, kindAndName, nkOf } from "./utils";

// Dynamic monaco; don’t crash if not installed
let MonacoDiff: React.ComponentType<any> | null = null;
(async () => {
  try {
    const mod = await import("@monaco-editor/react");
    MonacoDiff = (mod as any).DiffEditor || (mod as any).default?.DiffEditor || null;
  } catch {
    MonacoDiff = null;
  }
})();

type Props = {
  workspaceId: string;
  runs: DiscoveryRun[];
  selectedRunId: string | null;
  baseline: BaselineInfo;
};

export default function RunsDiffPanel({ workspaceId, runs, selectedRunId, baseline }: Props) {
  // selectors
  const [leftRunId, setLeftRunId] = useState<string | null>(null);
  const [rightRunId, setRightRunId] = useState<string | null>(null);

  const [leftArtifacts, setLeftArtifacts] = useState<Record<string, Artifact>>({});
  const [rightArtifacts, setRightArtifacts] = useState<Record<string, Artifact>>({});
  const [diffLoading, setDiffLoading] = useState(false);
  const [diffError, setDiffError] = useState<string | null>(null);

  const [selectedNk, setSelectedNk] = useState<string | null>(null);
  const [renderDiagram, setRenderDiagram] = useState(false);

  // Default sides
  useEffect(() => {
    if (!runs || runs.length === 0) return;

    const right = selectedRunId || runs[0]?.run_id;
    setRightRunId(right);

    const lastPromoted = baseline.last_promoted_run_id || null;
    const earliestBaseline = runs
      .filter((r: any) => r.status === "completed" && r.strategy === "baseline")
      .sort((a, b) => (a.result_summary?.started_at ?? "").localeCompare(b.result_summary?.started_at ?? ""))[0]?.run_id;

    const earliestCompleted = runs
      .filter((r: any) => r.status === "completed")
      .sort((a, b) => (a.result_summary?.started_at ?? "").localeCompare(b.result_summary?.started_at ?? ""))[0]?.run_id;

    const left =
      (lastPromoted && lastPromoted !== right ? lastPromoted : null) ||
      (earliestBaseline && earliestBaseline !== right ? earliestBaseline : null) ||
      (earliestCompleted && earliestCompleted !== right ? earliestCompleted : null) ||
      null;

    setLeftRunId(left);
  }, [runs, selectedRunId, baseline.last_promoted_run_id]);

  // load artifacts for a run
  const loadSide = async (rid: string | null) => {
    if (!rid) return {} as Record<string, Artifact>;
    const run = await callHost<DiscoveryRun>({ type: "runs:get", payload: { runId: rid } });
    const ids: string[] = (run as any)?.result_summary?.artifact_ids ?? [];
    const map: Record<string, Artifact> = {};
    for (const id of ids) {
      try {
        const { data } = await callHost<{ data: Artifact }>({
          type: "artifact:get",
          payload: { workspaceId, artifactId: id },
        });
        if (!data) continue;
        map[nkOf(data)] = {
          artifact_id: data.artifact_id,
          workspace_id: (data as any).workspace_id,
          kind: data.kind,
          name: data.name,
          natural_key: data.natural_key,
          fingerprint: (data as any).fingerprint,
          data: data.data,
        };
      } catch {
        /* ignore this artifact */
      }
    }
    return map;
  };

  useEffect(() => {
    (async () => {
      setDiffLoading(true);
      setDiffError(null);
      try {
        const [L, R] = await Promise.all([loadSide(leftRunId), loadSide(rightRunId)]);
        setLeftArtifacts(L);
        setRightArtifacts(R);
        setSelectedNk(null);
      } catch (e: any) {
        setDiffError(e?.message ?? "Failed to load runs for diff");
      } finally {
        setDiffLoading(false);
      }
    })();
  }, [leftRunId, rightRunId, workspaceId]);

  const derived = useMemo(() => computeDiff(leftArtifacts, rightArtifacts), [leftArtifacts, rightArtifacts]);

  const leftArt = selectedNk ? leftArtifacts[selectedNk] : undefined;
  const rightArt = selectedNk ? rightArtifacts[selectedNk] : undefined;

  const leftJson = useMemo(
    () => JSON.stringify(leftArt ? { kind: leftArt.kind, name: leftArt.name, fingerprint: leftArt.fingerprint, data: leftArt.data } : {}, null, 2),
    [leftArt]
  );
  const rightJson = useMemo(
    () => JSON.stringify(rightArt ? { kind: rightArt.kind, name: rightArt.name, fingerprint: rightArt.fingerprint, data: rightArt.data } : {}, null, 2),
    [rightArt]
  );

  const leftXml = (leftArt?.data?.drawio_xml as string) || (leftArt?.data?.diagramXml as string) || "";
  const rightXml = (rightArt?.data?.drawio_xml as string) || (rightArt?.data?.diagramXml as string) || "";
  const canRenderDiagram = !!(leftXml || rightXml);

  function openDrawio(which: "left" | "right") {
    const xml = which === "left" ? leftXml : rightXml;
    if (!xml) return;
    const ev = new CustomEvent("raina:openDrawio", { detail: { xml, title: `${which.toUpperCase()} • ${selectedNk}` } });
    window.dispatchEvent(ev);
  }

  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60">
      {/* selectors */}
      <div className="border-b border-neutral-800 p-3 md:p-4">
        <div className="flex flex-col md:flex-row md:items-end gap-3 md:gap-6">
          <div className="flex-1">
            <div className="text-xs uppercase tracking-wide text-neutral-400">Left</div>
            <select
              className="mt-1 w-full rounded-md border border-neutral-700 bg-neutral-900 p-2 text-sm"
              value={leftRunId ?? ""}
              onChange={(e) => setLeftRunId(e.target.value || null)}
            >
              <option value="">(none)</option>
              {runs.map((r) => (
                <option key={r.run_id} value={r.run_id}>
                  {r.title || r.result_summary?.title || r.run_id}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <div className="text-xs uppercase tracking-wide text-neutral-400">Right</div>
            <select
              className="mt-1 w-full rounded-md border border-neutral-700 bg-neutral-900 p-2 text-sm"
              value={rightRunId ?? ""}
              onChange={(e) => setRightRunId(e.target.value || null)}
            >
              <option value="">(none)</option>
              {runs.map((r) => (
                <option key={r.run_id} value={r.run_id}>
                  {r.title || r.result_summary?.title || r.run_id}
                </option>
              ))}
            </select>
          </div>

          <div className="grow" />
          <div className="text-xs text-neutral-400">
            {diffLoading ? "Computing diff…" : diffError ? <span className="text-red-400">{diffError}</span> : null}
          </div>
        </div>
      </div>

      {/* body */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
        {/* summary */}
        <div className="border-r border-neutral-800 p-3 md:p-4">
          <div className="text-sm font-medium text-neutral-200 mb-2">Summary</div>
          <Group title={`New (${derived.counts.new})`} rows={derived.groups.new} onRowClick={setSelectedNk} />
          <Group title={`Updated (${derived.counts.updated})`} rows={derived.groups.updated} onRowClick={setSelectedNk} defaultOpen />
          <Group title={`Retired (${derived.counts.retired})`} rows={derived.groups.retired} onRowClick={setSelectedNk} />
          <Group title={`Unchanged (${derived.counts.unchanged})`} rows={derived.groups.unchanged} onRowClick={setSelectedNk} />
        </div>

        {/* details */}
        <div className="p-3 md:p-4 min-w-0">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-neutral-200">Details</div>
            <label className="flex items-center gap-2 text-xs text-neutral-300">
              <Checkbox checked={renderDiagram} onCheckedChange={(v) => setRenderDiagram(Boolean(v))} disabled={!canRenderDiagram || !selectedNk} />
              Rendered Diagram
            </label>
          </div>

          {!selectedNk ? (
            <div className="mt-3 text-sm text-neutral-400">
              Select an <b>Updated</b> item to view JSON diff (or diagram).
            </div>
          ) : (
            <div className="mt-3">
              <div className="mb-2 text-xs text-neutral-400">
                <span className="font-mono">{selectedNk}</span>
              </div>

              {renderDiagram && canRenderDiagram ? (
                <div className="space-y-2">
                  <div className="text-xs text-neutral-400">Open in Draw.io viewer:</div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="secondary" disabled={!leftXml} onClick={() => openDrawio("left")}>
                      Open Left
                    </Button>
                    <Button size="sm" variant="secondary" disabled={!rightXml} onClick={() => openDrawio("right")}>
                      Open Right
                    </Button>
                  </div>
                  {!leftXml && !rightXml && <div className="text-xs text-neutral-500">No diagram XML found on either side.</div>}
                </div>
              ) : MonacoDiff ? (
                <div className="rounded-lg border border-neutral-800 overflow-hidden">
                  {/* @ts-ignore */}
                  <MonacoDiff
                    original={leftJson}
                    modified={rightJson}
                    language="json"
                    theme="vs-dark"
                    options={{ readOnly: true, renderSideBySide: true, automaticLayout: true, wordWrap: "on" }}
                    height="420px"
                  />
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="rounded-lg border border-neutral-800 bg-neutral-950 p-2">
                    <div className="text-xs text-neutral-400 mb-1">Left (JSON)</div>
                    <pre className="text-xs overflow-auto max-h-[420px]">{leftJson}</pre>
                  </div>
                  <div className="rounded-lg border border-neutral-800 bg-neutral-950 p-2">
                    <div className="text-xs text-neutral-400 mb-1">Right (JSON)</div>
                    <pre className="text-xs overflow-auto max-h-[420px]">{rightJson}</pre>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Group({
  title,
  rows,
  onRowClick,
  defaultOpen = false,
}: {
  title: string;
  rows: string[];
  onRowClick: (nk: string) => void;
  defaultOpen?: boolean;
}) {
  return (
    <details className="rounded-md border border-neutral-800 bg-neutral-900/50 mb-2" open={defaultOpen}>
      <summary className="cursor-pointer select-none px-3 py-2 text-sm text-neutral-200">{title}</summary>
      <ul className="px-2 py-1">
        {rows.length === 0 ? (
          <li className="px-2 py-1 text-xs text-neutral-500">—</li>
        ) : (
          rows.map((nk) => {
            const { kind, name } = kindAndName(nk);
            return (
              <li
                key={nk}
                onClick={() => onRowClick(nk)}
                className="px-2 py-1 text-sm hover:bg-neutral-800/70 rounded cursor-pointer flex items-center gap-2"
                title={nk}
              >
                <span className="rounded border border-neutral-700 bg-neutral-800/60 px-1.5 py-0.5 text-[11px] text-neutral-300">{kind}</span>
                <span className="truncate">{name || nk}</span>
              </li>
            );
          })
        )}
      </ul>
    </details>
  );
}
