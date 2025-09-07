/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
//webview-ui/raina-ui/src/components/runs/RunsTab.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useRainaStore } from "@/stores/useRainaStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp } from "lucide-react";
import { callHost } from "@/lib/host";

import RunListItem from "./RunListItem";
import RunsControls from "./RunsControls";
import RunsDiffPanel from "./RunsDiffPanel";
import type { BaselineInfo } from "./utils";

// NEW
import StepTracker from "@/components/runs/StepTracker";

type Props = { workspaceId: string };

export default function RunsTab({ workspaceId }: Props) {
  const {
    runs,
    loadRuns,
    deleteRun,
    refreshRun,
    startRun,
    selectedRunId,
    selectRun,
  } = useRainaStore();

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
        // workspace_id is not required in body; store passes it separately
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
    loadRuns(); // store knows currentWorkspaceId
  }, [loadRuns]);

  useEffect(() => {
    refreshBaseline();
  }, [workspaceId]);

  useEffect(() => {
    if (!selectedRunId && runs.length > 0) {
      selectRun(runs[0].run_id); // most recent first in your list
    }
  }, [runs, selectedRunId, selectRun]);

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

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return runs;
    return runs.filter((r) => {
      const title = (r.title || r.run_id).toLowerCase();
      const desc = (r.description || "").toLowerCase();
      const hay = `${title} ${desc} ${r.playbook_id} ${r.status}`;
      return hay.includes(needle);
    });
  }, [q, runs]);

  return (
    <div className="h-full w-full relative">
      <div className="grid h-full" style={{ gridTemplateColumns: collapsed ? "0px minmax(0,1fr)" : "360px minmax(0,1fr)" }}>
        {/* LEFT: runs list */}
        <div className={["bg-neutral-950/60", collapsed ? "" : "border-r border-neutral-800"].join(" ")}>
          {!collapsed && (
            <>
              <div className="p-3 flex items-center gap-2">
                <Input placeholder="Search runs…" value={q} onChange={(e) => setQ(e.target.value)} className="w-full" />
                <Button onClick={() => loadRuns()}>Refresh</Button>
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
                    The JSON below becomes the <code className="font-mono">requestBody</code> (the store adds the current workspace id).
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
                          // Ensure we don't send an extra workspace_id in the body
                          if (body && "workspace_id" in body) delete body.workspace_id;
                          const runId = await startRun(body);
                          if (runId) {
                            await refreshRun(runId);
                            setShowStart(false);
                            selectRun(runId);
                          }
                        } catch {
                          /* optional: toast */
                        }
                      }}
                    >
                      Start
                    </Button>
                  </div>
                </div>
              )}

              <div className="overflow-auto pb-3">
                {filtered.length === 0 ? (
                  <div className="px-3 py-6 text-neutral-400 text-sm">{q ? "No runs match your search." : "No runs yet. Start one to see it here."}</div>
                ) : (
                  <ul className="px-2">
                    {filtered.map((r) => (
                      <RunListItem
                        key={r.run_id}
                        run={r}
                        selected={r.run_id === selectedRunId}
                        onSelect={(id) => { selectRun(id); }}
                        onRefresh={refreshRun}
                        onDelete={deleteRun}
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

          {/* Live step tracker */}
          <StepTracker runId={selectedRunId ?? null} />

          <RunsDiffPanel
            workspaceId={workspaceId}
            runs={runs}
            selectedRunId={selectedRunId ?? null}
            baseline={baseline}
          />
        </div>
      </div>
    </div>
  );
}
