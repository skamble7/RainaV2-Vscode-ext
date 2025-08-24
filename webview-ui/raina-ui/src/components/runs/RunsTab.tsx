/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useMemo, useState } from "react";
import { useRunsStore } from "@/stores/useRunsStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp } from "lucide-react";
import { callHost } from "@/lib/host";

import RunListItem from "./RunListItem";
import RunsControls from "./RunsControls";
import RunsDiffPanel from "./RunsDiffPanel";
import type { BaselineInfo } from "./utils";

type Props = { workspaceId: string };

export default function RunsTab({ workspaceId }: Props) {
  const { items, loading, error, load, delete: del, refreshOne, start, selectedRunId, select } = useRunsStore();

  const [q, setQ] = useState("");
  const [showStart, setShowStart] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  // Controls panel collapsed state (persisted)
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
      /* noop */
    }
  }, [panelOpen]);

  // Baseline state (shared)
  const [baseline, setBaseline] = useState<BaselineInfo>({ version: null, fingerprint: null, last_promoted_run_id: null });
  const [blBusy, setBlBusy] = useState(false);

  const [startJson, setStartJson] = useState<string>(() =>
    JSON.stringify(
      {
        playbook_id: "pb.micro.plus",
        workspace_id: workspaceId,
        inputs: { avc: { vision: [], problem_statements: [], goals: [] }, fss: { stories: [] }, pss: { paradigm: "", style: [], tech_stack: [] } },
        options: { model: "openai:gpt-4o-mini", dry_run: false },
        title: "New discovery run",
        description: "Triggered from VS Code",
      },
      null,
      2
    )
  );

  // load runs & baseline
  useEffect(() => {
    load(workspaceId);
  }, [workspaceId, load]);

  useEffect(() => {
    refreshBaseline();
  }, [workspaceId]);

  async function refreshBaseline() {
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

  // keep workspace_id in JSON
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

  return (
    <div className="h-full w-full relative">
      <div className="grid h-full" style={{ gridTemplateColumns: collapsed ? "0px minmax(0,1fr)" : "360px minmax(0,1fr)" }}>
        {/* LEFT: runs list */}
        <div className={["bg-neutral-950/60", collapsed ? "" : "border-r border-neutral-800"].join(" ")}>
          {!collapsed && (
            <>
              <div className="p-3 flex items-center gap-2">
                <Input placeholder="Search runs…" value={q} onChange={(e) => setQ(e.target.value)} className="w-full" />
                <Button onClick={() => load(workspaceId)} disabled={loading}>Refresh</Button>
                <Button variant="secondary" onClick={() => setShowStart((s) => !s)}>Start</Button>
                <Button variant="ghost" size="icon" onClick={() => setCollapsed(true)} title="Collapse runs">
                  <ChevronLeft size={18} />
                </Button>
              </div>

              {showStart && (
                <div className="mx-3 mb-3 rounded-xl border border-neutral-800 bg-neutral-900/50 p-3">
                  <div className="flex items-center justify-between">
                    <div className="font-medium text-neutral-200">Start a new discovery run</div>
                    <Button size="sm" variant="ghost" onClick={() => setShowStart(false)}>Close</Button>
                  </div>
                  <p className="mt-2 text-sm text-neutral-400">
                    The JSON is sent to <code className="font-mono">POST /discover/{workspaceId}</code>.
                  </p>
                  <textarea className="mt-2 w-full min-h-40 rounded-md border border-neutral-700 bg-neutral-900 p-2 font-mono text-sm" value={startJson} onChange={(e) => setStartJson(e.target.value)} />
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
                          // silent; your toast layer can capture if needed
                        }
                      }}
                    >
                      Start
                    </Button>
                  </div>
                </div>
              )}

              {error && <div className="px-3 pb-2 text-sm text-red-400">{error}</div>}

              <div className="overflow-auto pb-3">
                {loading && items.length === 0 ? (
                  <div className="px-3 py-6 text-neutral-400 text-sm">Loading runs…</div>
                ) : filtered.length === 0 ? (
                  <div className="px-3 py-6 text-neutral-400 text-sm">{q ? "No runs match your search." : "No runs yet. Start one to see it here."}</div>
                ) : (
                  <ul className="px-2">
                    {filtered.map((r) => (
                      <RunListItem
                        key={r.run_id}
                        run={r}
                        selected={r.run_id === selectedRunId}
                        onSelect={(id) => { select(id); /* keep diff right in sync handled in RunsDiffPanel via selectedRunId prop */ }}
                        onRefresh={refreshOne}
                        onDelete={del}
                      />
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </div>

        {/* RIGHT: controls (collapsible) + diff */}
        <div className={`relative min-w-0 overflow-auto p-4 space-y-4 ${collapsed ? "pl-12" : ""}`}>
          {collapsed && (
            <div className="absolute left-2 top-2 z-10">
              <Button variant="ghost" size="icon" onClick={() => setCollapsed(false)} title="Expand runs" className="rounded-full border border-neutral-700 bg-neutral-900/70 hover:bg-neutral-900">
                <ChevronRight size={18} />
              </Button>
            </div>
          )}

          {panelOpen ? (
            <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60">
              <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800">
                <div className="text-sm font-medium text-neutral-200">Baseline & Run Controls</div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="ghost" onClick={() => refreshBaseline()} disabled={blBusy}>Refresh</Button>
                  <Button size="sm" variant="ghost" onClick={() => setPanelOpen(false)} className="gap-1" title="Collapse controls">
                    <ChevronUp size={16} /> Hide
                  </Button>
                </div>
              </div>
              <RunsControls
                workspaceId={workspaceId}
                baseline={baseline}
                onBaselineRefresh={refreshBaseline}
                selectedRunId={selectedRunId ?? null}
              />
            </div>
          ) : (
            <div className="flex items-center justify-end">
              <Button size="sm" variant="ghost" onClick={() => setPanelOpen(true)} className="gap-1 text-neutral-300" title="Show controls">
                <ChevronDown size={16} /> Show Controls
              </Button>
            </div>
          )}

          <RunsDiffPanel
            workspaceId={workspaceId}
            runs={items}
            selectedRunId={selectedRunId ?? null}
            baseline={baseline}
          />
        </div>
      </div>
    </div>
  );
}
