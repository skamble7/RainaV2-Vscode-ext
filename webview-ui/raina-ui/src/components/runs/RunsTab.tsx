/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useMemo, useRef, useState, Suspense } from "react";
import { useRunsStore, type DiscoveryRun } from "@/stores/useRunsStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronLeft, ChevronRight, ChevronUp, ChevronDown, RefreshCw, Trash2 } from "lucide-react";
import { callHost } from "@/lib/host";

type Props = { workspaceId: string };

type Artifact = {
  artifact_id: string;
  workspace_id: string;
  kind: string;
  name: string;
  natural_key?: string;
  fingerprint?: string;
  data?: any;
};

type DeltaCounts = {
  new: number;
  updated: number;
  unchanged: number;
  retired: number;
  deleted: number;
};

type BaselineInfo = {
  version: number | null;
  fingerprint: string | null;
  last_promoted_run_id?: string | null;
};

// Try dynamic Monaco import but don’t hard fail if missing
let MonacoDiff: React.ComponentType<any> | null = null;
(async () => {
  try {
    const mod = await import("@monaco-editor/react");
    MonacoDiff = (mod as any).DiffEditor || (mod as any).default?.DiffEditor || null;
  } catch {
    MonacoDiff = null;
  }
})();

// ─────────────────────────────────────────────────────────────
// helpers
// ─────────────────────────────────────────────────────────────
function countsOf(run: any) {
  const c = run?.artifacts_diff?.counts ?? run?.deltas?.counts ?? {};
  return {
    new: c.new ?? 0,
    updated: c.updated ?? 0,
    unchanged: c.unchanged ?? 0,
    retired: c.retired ?? 0,
    deleted: c.deleted ?? 0,
  } as DeltaCounts;
}

function nkOf(a: Partial<Artifact>): string {
  const nk = a.natural_key || (a.kind && a.name ? `${String(a.kind)}:${String(a.name)}` : "");
  return String(nk || "").toLowerCase();
}

function kindAndName(nk: string): { kind: string; name: string } {
  const i = nk.indexOf(":");
  if (i <= 0) return { kind: nk, name: "" };
  return { kind: nk.slice(0, i), name: nk.slice(i + 1) };
}

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === "completed"
      ? "bg-emerald-600/20 text-emerald-300"
      : status === "failed"
      ? "bg-red-600/20 text-red-300"
      : status === "running"
      ? "bg-sky-600/20 text-sky-300"
      : "bg-neutral-700/50 text-neutral-300";
  return <span className={`rounded-full px-2 py-0.5 text-[11px] ${cls}`}>{status}</span>;
}

function DeltaPill({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "emerald" | "sky" | "neutral" | "amber" | "red";
}) {
  const hidden = value === 0;
  const color =
    tone === "emerald"
      ? "bg-emerald-600/20 text-emerald-300 border-emerald-700/40"
      : tone === "sky"
      ? "bg-sky-600/20 text-sky-300 border-sky-700/40"
      : tone === "amber"
      ? "bg-amber-600/20 text-amber-300 border-amber-700/40"
      : tone === "red"
      ? "bg-red-600/20 text-red-300 border-red-700/40"
      : "bg-neutral-700/40 text-neutral-300 border-neutral-600/40";
  return (
    <span
      className={[
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px]",
        hidden ? "opacity-40" : "",
        color,
      ].join(" ")}
      title={String(value)}
    >
      <span className="capitalize">{label}</span>
      <span className="font-mono">{value}</span>
    </span>
  );
}

// Compute left↔right diff using artifact natural keys + fingerprint/id equality.
function computeDiff(left: Record<string, Artifact>, right: Record<string, Artifact>) {
  const leftKeys = new Set(Object.keys(left));
  const rightKeys = new Set(Object.keys(right));

  const unchanged: string[] = [];
  const updated: string[] = [];
  const newly: string[] = [];
  const retired: string[] = [];

  // Right-side sweep
  for (const nk of rightKeys) {
    if (!leftKeys.has(nk)) {
      newly.push(nk);
    } else {
      const l = left[nk];
      const r = right[nk];
      const sameId = l.artifact_id && r.artifact_id && l.artifact_id === r.artifact_id;
      const sameFp = l.fingerprint && r.fingerprint && l.fingerprint === r.fingerprint;
      if (sameId || sameFp) unchanged.push(nk);
      else updated.push(nk);
    }
  }
  // Retired = in left, not in right
  for (const nk of leftKeys) {
    if (!rightKeys.has(nk)) retired.push(nk);
  }

  newly.sort();
  updated.sort();
  unchanged.sort();
  retired.sort();

  const counts: DeltaCounts = {
    new: newly.length,
    updated: updated.length,
    unchanged: unchanged.length,
    retired: retired.length,
    deleted: 0,
  };

  return { counts, groups: { new: newly, updated, unchanged, retired } };
}

// ─────────────────────────────────────────────────────────────
// component
// ─────────────────────────────────────────────────────────────
export default function RunsTab({ workspaceId }: Props) {
  const { items, loading, error, load, delete: del, refreshOne, start, selectedRunId, select } =
    useRunsStore();

  const [q, setQ] = useState("");
  const [showStart, setShowStart] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  // Controls panel collapsed/expanded
  const [panelOpen, setPanelOpen] = useState<boolean>(() => {
    try {
      const v = localStorage.getItem("raina:runs:controlsOpen");
      return v === null ? true : v === "1";
    } catch {
      return true;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem("raina:runs:controlsOpen", panelOpen ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [panelOpen]);

  // RIGHT PANE: baseline panel
  const [baseline, setBaseline] = useState<BaselineInfo>({
    version: null,
    fingerprint: null,
    last_promoted_run_id: null,
  });
  const [blBusy, setBlBusy] = useState(false);
  const [blMsg, setBlMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  // For Merge / Promote we need full run details
  const [runDetail, setRunDetail] = useState<DiscoveryRun | null>(null);
  const [runDetailBusy, setRunDetailBusy] = useState(false);

  // Merge options
  const [mergeFSS, setMergeFSS] = useState(true);
  const [mergeAVC, setMergeAVC] = useState(false);
  const [mergePSS, setMergePSS] = useState(false);

  // Start JSON
  const [startJson, setStartJson] = useState<string>(() =>
    JSON.stringify(
      {
        playbook_id: "pb.micro.plus",
        workspace_id: workspaceId,
        inputs: {
          avc: { vision: [], problem_statements: [], goals: [] },
          fss: { stories: [] },
          pss: { paradigm: "", style: [], tech_stack: [] },
        },
        options: { model: "openai:gpt-4o-mini", dry_run: false },
        title: "New discovery run",
        description: "Triggered from VS Code",
      },
      null,
      2
    )
  );

  // DIFF VIEWER state
  const [leftRunId, setLeftRunId] = useState<string | null>(null);
  const [rightRunId, setRightRunId] = useState<string | null>(null);

  const [leftRun, setLeftRun] = useState<DiscoveryRun | null>(null);
  const [rightRun, setRightRun] = useState<DiscoveryRun | null>(null);
  const [leftArtifacts, setLeftArtifacts] = useState<Record<string, Artifact>>({});
  const [rightArtifacts, setRightArtifacts] = useState<Record<string, Artifact>>({});
  const [diffLoading, setDiffLoading] = useState(false);
  const [diffError, setDiffError] = useState<string | null>(null);

  // details pane (selected Updated NK)
  const [selectedNk, setSelectedNk] = useState<string | null>(null);
  const [renderDiagram, setRenderDiagram] = useState(false);

  // ---- Load runs + baseline on mount/workspace change
  useEffect(() => {
    load(workspaceId);
  }, [workspaceId, load]);

  useEffect(() => {
    const fetchBaseline = async () => {
      setBlBusy(true);
      try {
        const parent = await callHost<any>({ type: "workspace:get", payload: { id: workspaceId } });
        setBaseline({
          version: parent?.inputs_baseline_version ?? null,
          fingerprint: parent?.inputs_baseline_fingerprint ?? null,
          last_promoted_run_id: parent?.last_promoted_run_id ?? null,
        });
      } catch {
        // soft fail
      } finally {
        setBlBusy(false);
      }
    };
    fetchBaseline();
  }, [workspaceId]);

  // keep workspace_id in sync in Start JSON editor
  useEffect(() => {
    try {
      const obj = JSON.parse(startJson);
      if (obj && obj.workspace_id !== workspaceId) {
        obj.workspace_id = workspaceId;
        setStartJson(JSON.stringify(obj, null, 2));
      }
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((r) => {
      const title = (r.title || r.result_summary?.title || r.run_id).toLowerCase();
      const desc = (r.description || r.result_summary?.description || "").toLowerCase();
      const hay = `${title} ${desc} ${r.playbook_id} ${r.status}`;
      return hay.includes(needle);
    });
  }, [q, items]);

  const selectedRun: DiscoveryRun | undefined = items.find((r) => r.run_id === selectedRunId);

  // Default run selector (right = selected, left = last promoted / earliest baseline / earliest completed)
  useEffect(() => {
    if (!items || items.length === 0) return;

    // right
    const right = selectedRunId || items[0]?.run_id;
    setRightRunId(right);

    // left preference chain
    const lastPromoted = baseline.last_promoted_run_id || null;
    const earliestBaseline = items
      .filter((r: any) => r.status === "completed" && r.strategy === "baseline")
      .sort((a, b) => (a.result_summary?.started_at ?? "").localeCompare(b.result_summary?.started_at ?? ""))[0]?.run_id;

    const earliestCompleted = items
      .filter((r: any) => r.status === "completed")
      .sort((a, b) => (a.result_summary?.started_at ?? "").localeCompare(b.result_summary?.started_at ?? ""))[0]?.run_id;

    const left =
      (lastPromoted && lastPromoted !== right ? lastPromoted : null) ||
      (earliestBaseline && earliestBaseline !== right ? earliestBaseline : null) ||
      (earliestCompleted && earliestCompleted !== right ? earliestCompleted : null) ||
      null;

    setLeftRunId(left);
  }, [items, selectedRunId, baseline.last_promoted_run_id]);

  // Load full run + artifacts map when left/right selection changes
  useEffect(() => {
    const loadSide = async (rid: string | null) => {
      if (!rid) return { run: null as DiscoveryRun | null, map: {} as Record<string, Artifact> };
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
          const nk = nkOf(data);
          // store minimal fields we use
          map[nk] = {
            artifact_id: data.artifact_id,
            workspace_id: data.workspace_id,
            kind: data.kind,
            name: data.name,
            natural_key: data.natural_key,
            fingerprint: (data as any).fingerprint,
            data: data.data,
          };
        } catch {
          /* skip */
        }
      }
      return { run, map };
    };

    (async () => {
      setDiffLoading(true);
      setDiffError(null);
      try {
        const [L, R] = await Promise.all([loadSide(leftRunId), loadSide(rightRunId)]);
        setLeftRun(L.run);
        setRightRun(R.run);
        setLeftArtifacts(L.map);
        setRightArtifacts(R.map);
        // reset details selection on side change
        setSelectedNk(null);
      } catch (e: any) {
        setDiffError(e?.message ?? "Failed to load runs for diff");
      } finally {
        setDiffLoading(false);
      }
    })();
  }, [leftRunId, rightRunId, workspaceId]);

  // When a run gets selected in the left list, also load its detail for Promote/Merge areas
  useEffect(() => {
    const current = items.find((r) => r.run_id === selectedRunId);
    setRunDetail(null);
    if (!current) return;

    (async () => {
      setRunDetailBusy(true);
      try {
        const full = await callHost<DiscoveryRun>({ type: "runs:get", payload: { runId: current.run_id } });
        setRunDetail(full);
      } catch {
        setRunDetail(null);
      } finally {
        setRunDetailBusy(false);
      }
    })();
  }, [selectedRunId, items]);

  // --- Baseline panel helpers ---
  async function refreshBaselinePanel() {
    setBlBusy(true);
    try {
      const parent = await callHost<any>({ type: "workspace:get", payload: { id: workspaceId } });
      setBaseline({
        version: parent?.inputs_baseline_version ?? null,
        fingerprint: parent?.inputs_baseline_fingerprint ?? null,
        last_promoted_run_id: parent?.last_promoted_run_id ?? null,
      });
    } finally {
      setBlBusy(false);
    }
  }

  function setMsg(kind: "ok" | "err", text: string) {
    setBlMsg({ kind, text });
    setTimeout(() => setBlMsg(null), 3500);
  }

  async function handlePromoteToBaseline() {
    if (!selectedRun || !runDetail) {
      setMsg("err", "Select a run first.");
      return;
    }
    const inputs = (runDetail as any).inputs;
    if (!inputs) {
      setMsg("err", "Selected run has no inputs.");
      return;
    }
    try {
      setBlBusy(true);
      await callHost({
        type: "baseline:set",
        payload: {
          workspaceId,
          inputs,
          ifAbsentOnly: false,
          expectedVersion: baseline.version ?? undefined,
        },
      });
      await refreshBaselinePanel();
      setMsg("ok", "Baseline promoted from run.");
    } catch (e: any) {
      setMsg("err", e?.message ?? "Failed to promote baseline");
    } finally {
      setBlBusy(false);
    }
  }

  async function handleMergeFromRun() {
    if (!selectedRun || !runDetail) {
      setMsg("err", "Select a run first.");
      return;
    }
    const diff: any = (selectedRun as any).input_diff || (runDetail as any).input_diff;
    const inputs: any = (runDetail as any).inputs;

    if (!inputs || !diff) {
      setMsg("err", "Run inputs or diff not available yet.");
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
      setMsg("err", "Nothing to merge. Select at least one option.");
      return;
    }

    try {
      setBlBusy(true);
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
      await refreshBaselinePanel();
      setMsg("ok", "Baseline merged.");
    } catch (e: any) {
      setMsg("err", e?.message ?? "Failed to merge baseline");
    } finally {
      setBlBusy(false);
    }
  }

  // Derived diff
  const derivedDiff = useMemo(() => computeDiff(leftArtifacts, rightArtifacts), [leftArtifacts, rightArtifacts]);

  // Artifact detail (JSON) sources
  const leftArt = selectedNk ? leftArtifacts[selectedNk] : undefined;
  const rightArt = selectedNk ? rightArtifacts[selectedNk] : undefined;

  const leftJson = useMemo(
    () =>
      JSON.stringify(
        leftArt ? { kind: leftArt.kind, name: leftArt.name, fingerprint: leftArt.fingerprint, data: leftArt.data } : {},
        null,
        2
      ),
    [leftArt]
  );
  const rightJson = useMemo(
    () =>
      JSON.stringify(
        rightArt ? { kind: rightArt.kind, name: rightArt.name, fingerprint: rightArt.fingerprint, data: rightArt.data } : {},
        null,
        2
      ),
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
    <div className="h-full w-full relative">
      <div
        className="grid h-full"
        style={{
          gridTemplateColumns: collapsed ? "0px minmax(0,1fr)" : "360px minmax(0,1fr)",
        }}
      >
        {/* LEFT: Collapsible list */}
        <div className={["bg-neutral-950/60", collapsed ? "" : "border-r border-neutral-800"].join(" ")}>
          {!collapsed && (
            <>
              <div className="p-3 flex items-center gap-2">
                <Input
                  placeholder="Search runs…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  className="w-full"
                />
                <Button onClick={() => load(workspaceId)} disabled={loading}>
                  Refresh
                </Button>
                <Button variant="secondary" onClick={() => setShowStart((s) => !s)}>
                  Start
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setCollapsed(true)}
                  title="Collapse runs"
                >
                  <ChevronLeft size={18} />
                </Button>
              </div>

              {showStart && (
                <div className="mx-3 mb-3 rounded-xl border border-neutral-800 bg-neutral-900/50 p-3">
                  <div className="flex items-center justify-between">
                    <div className="font-medium text-neutral-200">Start a new discovery run</div>
                    <Button size="sm" variant="ghost" onClick={() => setShowStart(false)}>
                      Close
                    </Button>
                  </div>
                  <p className="mt-2 text-sm text-neutral-400">
                    The JSON is sent to <code className="font-mono">POST /discover/{workspaceId}</code>.
                  </p>
                  <textarea
                    className="mt-2 w-full min-h-40 rounded-md border border-neutral-700 bg-neutral-900 p-2 font-mono text-sm"
                    value={startJson}
                    onChange={(e) => setStartJson(e.target.value)}
                  />
                  <div className="mt-2 flex gap-2">
                    <Button
                      onClick={async () => {
                        try {
                          const body = JSON.parse(startJson);
                          const runId = await start(workspaceId, body);
                          if (runId) {
                            await refreshOne(runId);
                            setShowStart(false);
                            select(runId);
                          }
                        } catch (e) {
                          setMsg("err", `Invalid JSON: ${(e as any)?.message ?? e}`);
                        }
                      }}
                    >
                      Start
                    </Button>
                  </div>
                </div>
              )}

              {error && <div className="px-3 pb-2 text-sm text-red-400">{error}</div>}

              {/* Runs list */}
              <div className="overflow-auto pb-3">
                {loading && items.length === 0 ? (
                  <div className="px-3 py-6 text-neutral-400 text-sm">Loading runs…</div>
                ) : filtered.length === 0 ? (
                  <div className="px-3 py-6 text-neutral-400 text-sm">
                    {q ? "No runs match your search." : "No runs yet. Start one to see it here."}
                  </div>
                ) : (
                  <ul className="px-2">
                    {filtered.map((r) => {
                      const isSel = r.run_id === selectedRunId;
                      const title = r.title || r.result_summary?.title || r.run_id;
                      const desc = r.description || r.result_summary?.description || "";
                      const counts = countsOf(r);
                      return (
                        <li key={r.run_id} className="my-1">
                          <div
                            role="button"
                            tabIndex={0}
                            onClick={() => {
                              select(r.run_id);
                              setRightRunId(r.run_id); // keep diff right side in sync with selection
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                select(r.run_id);
                                setRightRunId(r.run_id);
                              }
                            }}
                            className={[
                              "relative w-full rounded-lg border transition p-3",
                              "cursor-pointer text-left",
                              isSel
                                ? "border-neutral-700 bg-neutral-900/80 ring-1 ring-neutral-600"
                                : "border-neutral-800 bg-neutral-900/40 hover:bg-neutral-900",
                              "min-h-[76px] pr-20",
                            ].join(" ")}
                          >
                            {/* Top-right icon actions */}
                            <div className="absolute right-2 top-2 flex gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  refreshOne(r.run_id);
                                }}
                                title="Refresh run"
                              >
                                <RefreshCw size={16} />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  del(r.run_id);
                                }}
                                title="Delete run"
                              >
                                <Trash2 size={16} />
                              </Button>
                            </div>

                            {/* Content */}
                            <div className="min-w-0">
                              <div className="truncate font-medium">{title}</div>
                              {!!desc && <div className="truncate text-xs text-neutral-400">{desc}</div>}

                              <div className="mt-1 flex items-center gap-2 text-[11px] text-neutral-400">
                                <span className="font-mono">{r.playbook_id}</span>
                                <span>•</span>
                                <StatusBadge status={r.status} />
                              </div>

                              {/* Delta pills (resilient to missing backend diffs) */}
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                <DeltaPill label="new" value={counts.new} tone="emerald" />
                                <DeltaPill label="updated" value={counts.updated} tone="sky" />
                                <DeltaPill label="unchanged" value={counts.unchanged} tone="neutral" />
                                <DeltaPill label="retired" value={counts.retired} tone="amber" />
                                <DeltaPill label="deleted" value={counts.deleted} tone="red" />
                              </div>
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </>
          )}
        </div>

        {/* RIGHT: Controls panel (collapsible) + Diff viewer */}
        <div className={`relative min-w-0 overflow-auto p-4 space-y-4 ${collapsed ? "pl-12" : ""}`}>
          {collapsed && (
            <div className="absolute left-2 top-2 z-10">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setCollapsed(false)}
                title="Expand runs"
                className="rounded-full border border-neutral-700 bg-neutral-900/70 hover:bg-neutral-900"
              >
                <ChevronRight size={18} />
              </Button>
            </div>
          )}

          {/* Controls Panel (Baseline / Promote / Merge) */}
          {panelOpen ? (
            <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60">
              {/* Panel header with collapse control */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800">
                <div className="text-sm font-medium text-neutral-200">Baseline & Run Controls</div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="ghost" onClick={refreshBaselinePanel} disabled={blBusy}>
                    Refresh
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setPanelOpen(false)}
                    title="Collapse controls"
                    className="gap-1"
                  >
                    <ChevronUp size={16} />
                    Hide
                  </Button>
                </div>
              </div>

              <div className="p-4 space-y-4">
                {/* Baseline row */}
                <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-3">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="text-xs text-neutral-400">
                      <div className="uppercase tracking-wide">Version</div>
                      <div className="mt-1 font-mono text-neutral-200">
                        {baseline.version ?? <span className="text-neutral-500">N/A</span>}
                      </div>
                    </div>
                    <div className="text-xs text-neutral-400">
                      <div className="uppercase tracking-wide">Fingerprint</div>
                      <div className="mt-1 font-mono text-neutral-200 truncate" title={baseline.fingerprint || ""}>
                        {baseline.fingerprint ?? <span className="text-neutral-500">N/A</span>}
                      </div>
                    </div>
                    <div className="text-xs text-neutral-400">
                      <div className="uppercase tracking-wide">Last Promoted Run</div>
                      <div
                        className="mt-1 font-mono text-neutral-200 truncate"
                        title={baseline.last_promoted_run_id || ""}
                      >
                        {baseline.last_promoted_run_id ?? <span className="text-neutral-500">N/A</span>}
                      </div>
                    </div>
                  </div>

                  {/* Inline status */}
                  {blMsg && (
                    <div
                      className={`mt-3 rounded-md px-2 py-1 text-xs ${
                        blMsg.kind === "ok" ? "bg-emerald-600/15 text-emerald-300" : "bg-red-600/15 text-red-300"
                      }`}
                    >
                      {blMsg.text}
                    </div>
                  )}
                </div>

                {/* Promote from selected run */}
                <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-3">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium text-neutral-200">Promote to Baseline</div>
                    <div className="text-[11px] text-neutral-400">
                      {runDetailBusy ? "Loading run…" : selectedRun ? (
                        <span className="font-mono">{selectedRun.run_id}</span>
                      ) : (
                        "Select a run"
                      )}
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-neutral-400">
                    Replace the baseline with the selected run’s full <span className="font-mono">inputs</span>.
                  </div>
                  <div className="mt-3">
                    <Button
                      size="sm"
                      onClick={handlePromoteToBaseline}
                      disabled={!selectedRun || blBusy || runDetailBusy}
                      title={!selectedRun ? "Select a run first" : ""}
                    >
                      Promote
                    </Button>
                  </div>
                </div>

                {/* Merge from selected run */}
                <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-3">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium text-neutral-200">Merge from Run</div>
                    <div className="text-[11px] text-neutral-400">
                      {runDetailBusy ? "Loading run…" : selectedRun ? (
                        <span className="font-mono">{selectedRun.run_id}</span>
                      ) : (
                        "Select a run"
                      )}
                    </div>
                  </div>

                  <div className="mt-2 text-xs text-neutral-400">
                    Use the run’s <span className="font-mono">input_diff</span> to upsert changed bits.
                  </div>

                  <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
                    <label className="flex items-center gap-2">
                      <Checkbox checked={mergeFSS} onCheckedChange={(v) => setMergeFSS(Boolean(v))} />
                      Upsert FSS stories (added + updated)
                    </label>
                    <label className="flex items-center gap-2">
                      <Checkbox checked={mergeAVC} onCheckedChange={(v) => setMergeAVC(Boolean(v))} />
                      Replace AVC
                    </label>
                    <label className="flex items-center gap-2">
                      <Checkbox checked={mergePSS} onCheckedChange={(v) => setMergePSS(Boolean(v))} />
                      Replace PSS
                    </label>
                  </div>

                  {(selectedRun as any)?.input_diff?.fss && (
                    <div className="mt-2 text-[11px] text-neutral-400">
                      FSS Δ: +{(selectedRun as any).input_diff.fss.added_keys?.length ?? 0} / updated{" "}
                      {((selectedRun as any).input_diff.fss.updated?.length ?? 0)}
                    </div>
                  )}

                  <div className="mt-3">
                    <Button
                      size="sm"
                      onClick={handleMergeFromRun}
                      disabled={!selectedRun || blBusy || runDetailBusy}
                      title={!selectedRun ? "Select a run first" : ""}
                    >
                      Merge
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            // Collapsed bar (doesn't take vertical space)
            <div className="flex items-center justify-end">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setPanelOpen(true)}
                className="gap-1 text-neutral-300"
                title="Show controls"
              >
                <ChevronDown size={16} />
                Show Controls
              </Button>
            </div>
          )}

          {/* Diff Viewer */}
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60">
            {/* Header: run selectors */}
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
                    {items.map((r) => (
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
                    {items.map((r) => (
                      <option key={r.run_id} value={r.run_id}>
                        {r.title || r.result_summary?.title || r.run_id}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grow"></div>
                <div className="text-xs text-neutral-400">
                  {diffLoading ? "Computing diff…" : diffError ? <span className="text-red-400">{diffError}</span> : null}
                </div>
              </div>
            </div>

            {/* Split: Summary | Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
              {/* Summary (accordions) */}
              <div className="border-r border-neutral-800 p-3 md:p-4">
                <div className="text-sm font-medium text-neutral-200 mb-2">Summary</div>

                <Group
                  title={`New (${derivedDiff.counts.new})`}
                  rows={derivedDiff.groups.new}
                  onRowClick={(nk) => setSelectedNk(nk)}
                />
                <Group
                  title={`Updated (${derivedDiff.counts.updated})`}
                  rows={derivedDiff.groups.updated}
                  onRowClick={(nk) => setSelectedNk(nk)}
                  defaultOpen
                />
                <Group
                  title={`Retired (${derivedDiff.counts.retired})`}
                  rows={derivedDiff.groups.retired}
                  onRowClick={(nk) => setSelectedNk(nk)}
                />
                <Group
                  title={`Unchanged (${derivedDiff.counts.unchanged})`}
                  rows={derivedDiff.groups.unchanged}
                  onRowClick={(nk) => setSelectedNk(nk)}
                />
              </div>

              {/* Details */}
              <div className="p-3 md:p-4 min-w-0">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium text-neutral-200">Details</div>
                  <label className="flex items-center gap-2 text-xs text-neutral-300">
                    <Checkbox
                      checked={renderDiagram}
                      onCheckedChange={(v) => setRenderDiagram(Boolean(v))}
                      disabled={!canRenderDiagram || !selectedNk}
                    />
                    Rendered Diagram
                  </label>
                </div>

                {!selectedNk ? (
                  <div className="mt-3 text-sm text-neutral-400">
                    Select an <b>Updated</b> item to view JSON diff (or diagram).
                  </div>
                ) : (
                  <div className="mt-3">
                    {/* Title */}
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
                        {!leftXml && !rightXml && (
                          <div className="text-xs text-neutral-500">No diagram XML found on either side.</div>
                        )}
                      </div>
                    ) : MonacoDiff ? (
                      <div className="rounded-lg border border-neutral-800 overflow-hidden">
                        {/* @ts-ignore */}
                        <MonacoDiff
                          original={leftJson}
                          modified={rightJson}
                          language="json"
                          theme="vs-dark"
                          options={{
                            readOnly: true,
                            renderSideBySide: true,
                            automaticLayout: true,
                            wordWrap: "on",
                          }}
                          height="420px"
                        />
                      </div>
                    ) : (
                      // Fallback when Monaco isn't available
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
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// tiny Group (accordion) using <details> for zero-deps
// ─────────────────────────────────────────────────────────────
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
                <span className="rounded border border-neutral-700 bg-neutral-800/60 px-1.5 py-0.5 text-[11px] text-neutral-300">
                  {kind}
                </span>
                <span className="truncate">{name || nk}</span>
              </li>
            );
          })
        )}
      </ul>
    </details>
  );
}
