/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useMemo, useState } from "react";
import { useRunsStore, type DiscoveryRun } from "@/stores/useRunsStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronLeft, ChevronRight, RefreshCw, Trash2 } from "lucide-react";
import { callHost } from "@/lib/host";

type Props = { workspaceId: string };

type Artifact = {
  artifact_id: string;
  workspace_id: string;
  kind: string;
  name: string;
  data?: any;
};

export default function RunsTab({ workspaceId }: Props) {
  const { items, loading, error, load, delete: del, refreshOne, start, selectedRunId, select } =
    useRunsStore();
  const [q, setQ] = useState("");
  const [showStart, setShowStart] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  // Right pane data: artifacts discovered by selected run
  const [artifactsLoading, setArtifactsLoading] = useState(false);
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [artifactsError, setArtifactsError] = useState<string | undefined>(undefined);

  // Seed payload
  const [startJson, setStartJson] = useState<string>(() =>
    JSON.stringify(
      {
        playbook_id: "pb.micro.plus",
        workspace_id: workspaceId,
        inputs: { avc: { vision: [], problem_statements: [], goals: [] }, fss: {}, pss: {} },
        options: { model: "openai:gpt-4o-mini", dry_run: false },
        title: "New discovery run",
        description: "Triggered from VS Code",
      },
      null,
      2
    )
  );

  useEffect(() => { load(workspaceId); }, [workspaceId, load]);

  // keep workspace_id in sync
  useEffect(() => {
    try {
      const obj = JSON.parse(startJson);
      if (obj && obj.workspace_id !== workspaceId) {
        obj.workspace_id = workspaceId;
        setStartJson(JSON.stringify(obj, null, 2));
      }
    } catch { /* ignore */ }
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

  // When a run gets selected, fetch its artifacts
  useEffect(() => {
    const current = items.find((r) => r.run_id === selectedRunId);
    if (!current) {
      setArtifacts([]);
      setArtifactsError(undefined);
      return;
    }
    const ids = current.result_summary?.artifact_ids ?? [];
    if (!ids.length) {
      setArtifacts([]);
      setArtifactsError(undefined);
      return;
    }

    (async () => {
      setArtifactsLoading(true);
      setArtifactsError(undefined);
      try {
        const results: Artifact[] = [];
        for (const id of ids) {
          const { data } = await callHost<{ data: Artifact }>({
            type: "artifact:get",
            payload: { workspaceId, artifactId: id },
          });
          if (data) results.push(data);
        }
        setArtifacts(results);
      } catch (e: any) {
        setArtifactsError(e?.message ?? "Failed to load artifacts for this run");
      } finally {
        setArtifactsLoading(false);
      }
    })();
  }, [selectedRunId, items, workspaceId]);

  const selectedRun: DiscoveryRun | undefined = items.find((r) => r.run_id === selectedRunId);

  return (
    <div className="h-full w-full relative">
      <div
        className="grid h-full"
        style={{
          gridTemplateColumns: collapsed ? "0px minmax(0,1fr)" : "340px minmax(0,1fr)",
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
                          // eslint-disable-next-line no-alert
                          alert(`Invalid JSON: ${(e as any)?.message ?? e}`);
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
                      return (
                        <li key={r.run_id} className="my-1">
                          <div
                            role="button"
                            tabIndex={0}
                            onClick={() => select(r.run_id)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                select(r.run_id);
                              }
                            }}
                            className={[
                              "relative w-full rounded-lg border transition p-3",
                              "cursor-pointer text-left",
                              isSel
                                ? "border-neutral-700 bg-neutral-900/80 ring-1 ring-neutral-600"
                                : "border-neutral-800 bg-neutral-900/40 hover:bg-neutral-900",
                              "min-h-[64px] pr-20", // reserved space
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
                              {!!desc && (
                                <div className="truncate text-xs text-neutral-400">{desc}</div>
                              )}
                              <div className="mt-1 flex items-center gap-2 text-xs text-neutral-400">
                                <span className="font-mono">{r.playbook_id}</span>
                                <span>•</span>
                                <StatusBadge status={r.status} />
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

        {/* RIGHT: Artifacts */}
        <div className={`relative min-w-0 overflow-auto p-4 ${collapsed ? "pl-12" : ""}`}>
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

          {!selectedRun ? (
            <div className="text-neutral-400 text-sm">Select a run to view discovered artifacts.</div>
          ) : artifactsLoading ? (
            <div className="text-neutral-400 text-sm">Loading artifacts…</div>
          ) : artifactsError ? (
            <div className="text-red-400 text-sm">{artifactsError}</div>
          ) : artifacts.length === 0 ? (
            <div className="text-neutral-400 text-sm">This run has no artifacts (or none yet).</div>
          ) : (
            <div className="space-y-3">
              {artifacts.map((a) => (
                <div
                  key={a.artifact_id}
                  className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-4"
                >
                  <div className="text-xs uppercase tracking-wide text-neutral-400">{a.kind}</div>
                  <div className="font-medium">{a.name}</div>
                  <div className="text-xs text-neutral-500 mt-1 font-mono">{a.artifact_id}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
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
