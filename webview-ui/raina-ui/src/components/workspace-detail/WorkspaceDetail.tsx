// src/components/workspace-detail/WorkspaceDetail.tsx
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Search } from "lucide-react";
import { useWorkspaceDetailStore } from "@/stores/useWorkspaceDetailStore";
import ArtifactView from "./artifact/ArtifactView";

// NEW: Runs tab
import RunsTab from "@/components/runs/RunsTab";

// NEW: discover drawer + toaster
import DiscoverArtifactsDrawer from "@/components/workspace-detail/forms/DiscoverArtifactsDrawer";
import { Toaster } from "@/components/ui/toaster";

/* ===== Root ===== */
type Props = { workspaceId: string; onBack: () => void };

export default function WorkspaceDetail({ workspaceId, onBack }: Props) {
  const { load, tab } = useWorkspaceDetailStore();
  const [discoverOpen, setDiscoverOpen] = useState(false);

  useEffect(() => { load(workspaceId); }, [workspaceId, load]);

  return (
    <div className="w-screen h-screen flex flex-col bg-neutral-950 text-neutral-100">
      {/* Toasts */}
      <Toaster />

      {/* Sticky header */}
      <div className="sticky top-0 z-10 border-b border-neutral-800 bg-neutral-950/80 backdrop-blur shrink-0">
        <HeaderBar onBack={onBack} onOpenDiscover={() => setDiscoverOpen(true)} />
      </div>

      {/* Filter row — only for Artifacts tab */}
      {tab === "artifacts" && (
        <div className="border-b border-neutral-800 shrink-0">
          <TopFilterRow />
        </div>
      )}

      {/* Main body */}
      <BodyTwoColumn workspaceId={workspaceId} />

      {/* Discover Drawer */}
      <DiscoverArtifactsDrawer
        workspaceId={workspaceId}
        open={discoverOpen}
        onOpenChange={setDiscoverOpen}
      />
    </div>
  );
}

/* ===== Header (single-row: back+title | centered tabs | actions) ===== */
function HeaderBar({ onBack, onOpenDiscover }: { onBack: () => void; onOpenDiscover: () => void }) {
  const { detail, loading, tab, setTab, updateWorkspaceMeta } = useWorkspaceDetailStore();
  const [editing, setEditing] = React.useState(false);
  const [name, setName] = React.useState(detail?.workspace?.name ?? "");
  const [desc, setDesc] = React.useState(detail?.workspace?.description ?? "");

  useEffect(() => {
    if (!editing) {
      setName(detail?.workspace?.name ?? "");
      setDesc(detail?.workspace?.description ?? "");
    }
  }, [detail, editing]);

  return (
    <div className="relative max-w-[1400px] mx-auto px-4 py-1.5 flex items-center">
      {/* Left: Back + Title / Inline edit */}
      <div className="flex items-center gap-3 min-w-0">
        <Button variant="ghost" onClick={onBack}>← Back</Button>

        <div className="min-w-0">
          {editing ? (
            <div className="flex items-center gap-2">
              <Input
                className="h-8 max-w-xs"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <Button
                size="sm"
                className="h-8"
                onClick={async () => {
                  await updateWorkspaceMeta({ name, description: desc });
                  setEditing(false);
                }}
              >
                Save
              </Button>
              <Button size="sm" variant="ghost" className="h-8" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            </div>
          ) : (
            <div
              className="text-2xl font-semibold truncate max-w-[40vw]"
              title={detail?.workspace?.name}
            >
              {loading ? "Loading…" : detail?.workspace?.name ?? "Workspace"}
            </div>
          )}
        </div>
      </div>

      {/* Center: Tabs (absolutely centered to stay true-center) */}
      <div className="absolute left-1/2 -translate-x-1/2">
        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <TabsList className="mx-auto">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="artifacts">Artifacts</TabsTrigger>
            <TabsTrigger value="conversations">Conversations</TabsTrigger>
            <TabsTrigger value="runs">Runs</TabsTrigger>
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Right: grouped actions, docked */}
      <div className="ml-auto shrink-0">
        <div className="flex items-center rounded-xl border border-neutral-800 bg-neutral-900/50 overflow-hidden shadow-sm">
          {/* Discover — now opens the right-side drawer */}
          <Button variant="ghost" className="rounded-none px-4" onClick={onOpenDiscover}>
            Discover
          </Button>

          <div className="w-px h-6 bg-neutral-800" />

          {/* Guide */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="rounded-none px-4">
                Guide
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>Architecture Guide</DropdownMenuItem>
              <DropdownMenuItem>Dev Hand-off</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="w-px h-6 bg-neutral-800" />

          {/* Export */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="rounded-none px-4">
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>Bundle (.zip)</DropdownMenuItem>
              <DropdownMenuItem>Markdown</DropdownMenuItem>
              <DropdownMenuItem>JSON</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setEditing(true)}>Edit name/description</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}

/* ===== Top filter row ===== */
function TopFilterRow() {
  const { setQuery, toggleKind, toggleDocType, counts } = useWorkspaceDetailStore();
  const c = counts();
  return (
    <div className="max-w-[1400px] mx-auto px-4 py-2 flex items-center gap-3">
      <div className="text-xs text-neutral-400 shrink-0">
        Artifacts: <span className="text-neutral-200">{c.artifacts}</span> • Events {c.events} • APIs {c.apis} • NFRs {c.nfrs} • Topology {c.topology} • ADRs {c.adrs}
      </div>
      <div className="flex-1" />
      <div className="relative">
        <Search className="absolute left-2 top-2.5 h-4 w-4 text-neutral-500" />
        <Input className="pl-8 w-64" placeholder="Search…" onChange={(e) => setQuery(e.target.value)} />
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild><Button variant="outline" size="sm">Kinds</Button></DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => toggleKind("cam.document")}>cam.document</DropdownMenuItem>
          <DropdownMenuItem onClick={() => toggleKind("cam.sequence_diagram")}>cam.sequence_diagram</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <DropdownMenu>
        <DropdownMenuTrigger asChild><Button variant="outline" size="sm">Doc Types</Button></DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => toggleDocType("event_catalog")}>event_catalog</DropdownMenuItem>
          <DropdownMenuItem onClick={() => toggleDocType("api_contracts")}>api_contracts</DropdownMenuItem>
          <DropdownMenuItem onClick={() => toggleDocType("nfr_matrix")}>nfr_matrix</DropdownMenuItem>
          <DropdownMenuItem onClick={() => toggleDocType("deployment_topology")}>deployment_topology</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

/* ===== Two-column body ===== */
function BodyTwoColumn({ workspaceId }: { workspaceId: string }) {
  const {
    tab, loading, filteredArtifacts, selectArtifact, refreshArtifact, selectedArtifactId,
  } = useWorkspaceDetailStore();

  // Non-artifact tabs
  if (tab === "overview") {
    return (
      <div className="max-w-[1400px] mx-auto px-4 py-6 text-sm text-neutral-400">
        Overview coming up…
      </div>
    );
  }
  if (tab === "conversations") {
    return (
      <div className="max-w-[1400px] mx-auto px-4 py-6 text-sm text-neutral-400">
        Conversations (agent threads) coming soon…
      </div>
    );
  }
  if (tab === "runs") {
    // FULL-BLEED runs UI (no centered container)
    return (
      <div className="flex-1 min-h-0">
        <RunsTab workspaceId={workspaceId} />
      </div>
    );
  }
  if (tab === "timeline") {
    return (
      <div className="max-w-[1400px] mx-auto px-4 py-6 text-sm text-neutral-400">
        Timeline coming soon…
      </div>
    );
  }

  // Default: artifacts two-column
  const list = filteredArtifacts();

  return (
    <div className="flex-1 overflow-hidden min-h-0">
      <div className="max-w-[1400px] mx-auto w-full h-full px-4 py-4 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_520px] gap-4 min-h-0">
        {/* Left column */}
        <div className="h-full overflow-auto pr-2 min-h-0">
          {loading && list.length === 0 ? (
            <div className="text-neutral-400 text-sm">Loading artifacts…</div>
          ) : list.length === 0 ? (
            <div className="text-neutral-400 text-sm">No artifacts match your filters.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-2 gap-4">
              {list.map((a) => {
                const isSelected = selectedArtifactId === a.artifact_id;
                return (
                  <div
                    key={a.artifact_id}
                    role="button"
                    tabIndex={0}
                    aria-selected={isSelected}
                    className={[
                      "rounded-2xl border p-4 transition outline-none cursor-pointer",
                      "bg-neutral-900/50 hover:bg-neutral-900",
                      isSelected ? "border-neutral-700 ring-1 ring-neutral-600" : "border-neutral-800",
                    ].join(" ")}
                    onClick={async () => {
                      selectArtifact(a.artifact_id);
                      await refreshArtifact(a.artifact_id);
                    }}
                    onKeyDown={async (e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        selectArtifact(a.artifact_id);
                        await refreshArtifact(a.artifact_id);
                      }
                    }}
                  >
                    <div className="text-xs uppercase tracking-wide text-neutral-400">{a.kind}</div>
                    <div className="font-medium">{a.name}</div>
                    <div className="text-xs text-neutral-400 mt-1">{describeArtifact(a)}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="h-full overflow-auto min-h-0">
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/50 h-full min-h-0">
            <ArtifactView />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ===== Helpers ===== */
function describeArtifact(a: any): string | null {
  if (a?.kind === "cam.sequence_diagram") {
    const count = a?.data?.artifacts?.length ?? 0;
    return `${count} sequence(s)`;
  }
  if (a?.kind === "cam.document") {
    const dt = a?.data?.doc_type;
    if (!dt && Array.isArray(a?.data?.artifacts)) return `${a.data.artifacts.length} embedded artifact(s)`;
    switch (dt) {
      case "event_catalog": return `${a?.data?.events?.length ?? 0} event(s)`;
      case "nfr_matrix": return `${a?.data?.nfrs?.length ?? 0} NFR(s)`;
      case "api_contracts": return `${a?.data?.services?.length ?? 0} service contract(s)`;
      case "deployment_topology": return `${a?.data?.environments?.length ?? 0} environment(s)`;
      case "runbooks_slo": return `${a?.data?.services?.length ?? 0} runbook target(s)`;
      default:
        if (a?.data?.contexts && a?.data?.relationships) {
          return `${a.data.contexts.length} context(s), ${a.data.relationships.length} relationship(s)`;
        }
        return null;
    }
  }
  return null;
}
