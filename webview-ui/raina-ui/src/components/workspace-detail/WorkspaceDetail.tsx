//webview-ui/raina-ui/src/components/workspace-detail/WorkspaceDetail.tsx
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Search } from "lucide-react";
import { useRainaStore } from "@/stores/useRainaStore";
import ArtifactView from "./artifact/ArtifactView";

import RunsTab from "@/components/runs/RunsTab";
import Overview from "@/components/overview/Overview";
import DiscoverArtifactsDrawer from "@/components/workspace-detail/forms/DiscoverArtifactsDrawer";
import { Toaster } from "@/components/ui/toaster";
import ViewToggle from "@/components/workspace/ViewToggle";
import { callHost } from "@/lib/host";

/* ===== Root ===== */
type Props = { workspaceId: string; onBack: () => void };

export default function WorkspaceDetail({ workspaceId, onBack }: Props) {
  const { switchWorkspace, ui } = useRainaStore();
  const [discoverOpen, setDiscoverOpen] = useState(false);

  // Artifacts view preference (grid | list)
  const [artifactsView, setArtifactsView] = useState<"grid" | "list">(() => {
    try {
      return (localStorage.getItem("raina:artifacts:view") as "grid" | "list") || "grid";
    } catch {
      return "grid";
    }
  });
  useEffect(() => {
    try { localStorage.setItem("raina:artifacts:view", artifactsView); } catch { /* ignore */ }
  }, [artifactsView]);

  useEffect(() => { switchWorkspace(workspaceId); }, [workspaceId, switchWorkspace]);

  useEffect(() => {
    const handler = () => setDiscoverOpen(true);
    window.addEventListener("raina:openDiscover" as any, handler as any);
    return () => window.removeEventListener("raina:openDiscover" as any, handler as any);
  }, []);

  return (
    <div className="w-screen h-screen flex flex-col bg-neutral-950 text-neutral-100">
      <Toaster />
      <div className="sticky top-0 z-10 border-b border-neutral-800 bg-neutral-950/80 backdrop-blur shrink-0">
        <HeaderBar onBack={onBack} onOpenDiscover={() => setDiscoverOpen(true)} />
      </div>

      {ui.tab === "artifacts" && (
        <div className="border-b border-neutral-800 shrink-0">
          <TopFilterRow view={artifactsView} onChangeView={setArtifactsView} />
        </div>
      )}

      <BodyTwoColumn workspaceId={workspaceId} view={artifactsView} />

      <DiscoverArtifactsDrawer
        workspaceId={workspaceId}
        open={discoverOpen}
        onOpenChange={setDiscoverOpen}
      />
    </div>
  );
}

/* ===== Header (unchanged) ===== */
function HeaderBar({ onBack, onOpenDiscover }: { onBack: () => void; onOpenDiscover: () => void }) {
  const { wsDoc, loading, ui, setTab, updateWorkspaceMeta } = useRainaStore();
  const [editing, setEditing] = React.useState(false);
  const [name, setName] = React.useState(wsDoc?.workspace?.name ?? "");
  const [desc, setDesc] = React.useState(wsDoc?.workspace?.description ?? "");

  useEffect(() => {
    if (!editing) {
      setName(wsDoc?.workspace?.name ?? "");
      setDesc(wsDoc?.workspace?.description ?? "");
    }
  }, [wsDoc, editing]);

  return (
    <div className="relative max-w-[1400px] mx-auto px-4 py-1.5 flex items-center">
      <div className="flex items-center gap-3 min-w-0">
        <Button variant="ghost" onClick={onBack}>← Back</Button>

        <div className="min-w-0">
          {editing ? (
            <div className="flex items-center gap-2">
              <Input className="h-8 max-w-xs" value={name} onChange={(e) => setName(e.target.value)} />
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
            <div className="text-2xl font-semibold truncate max-w-[40vw]" title={wsDoc?.workspace?.name}>
              {loading ? "Loading…" : wsDoc?.workspace?.name ?? "Workspace"}
            </div>
          )}
        </div>
      </div>

      <div className="absolute left-1/2 -translate-x-1/2">
        <Tabs value={ui.tab} onValueChange={(v) => setTab(v as any)}>
          <TabsList className="mx-auto">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="artifacts">Artifacts</TabsTrigger>
            <TabsTrigger value="conversations">Conversations</TabsTrigger>
            <TabsTrigger value="runs">Runs</TabsTrigger>
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="ml-auto shrink-0">
        <div className="flex items-center rounded-xl border border-neutral-800 bg-neutral-900/50 overflow-hidden shadow-sm">
          <Button variant="ghost" className="rounded-none px-4" onClick={onOpenDiscover}>
            Discover
          </Button>

          <div className="w-px h-6 bg-neutral-800" />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="rounded-none px-4">Guide</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>Architecture Guide</DropdownMenuItem>
              <DropdownMenuItem>Dev Hand-off</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="w-px h-6 bg-neutral-800" />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="rounded-none px-4">Export</Button>
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

/* ===== Top filter row (unchanged) ===== */
function TopFilterRow({
  view,
  onChangeView,
}: {
  view: "grid" | "list";
  onChangeView: (v: "grid" | "list") => void;
}) {
  const { setQuery, toggleKind, counts, wsDoc } = useRainaStore();
  const c = counts();

  const kindsInWorkspace = useMemo(() => {
    const s = new Set<string>();
    for (const a of (wsDoc?.artifacts ?? [])) if (a?.kind) s.add(a.kind);
    return Array.from(s).sort();
  }, [wsDoc?.artifacts]);

  return (
    <div className="max-w-[1400px] mx-auto px-4 py-2 flex items-center gap-3">
      <div className="text-xs text-neutral-400 shrink-0 whitespace-nowrap">
        Artifacts: <span className="text-neutral-200">{c.total}</span>
        {Object.entries(c.byCategory).map(([k, v]) => (
          <span key={k}> • {k} {v}</span>
        ))}
      </div>
      <div className="flex-1" />
      <div className="relative">
        <Search className="absolute left-2 top-2.5 h-4 w-4 text-neutral-500" />
        <Input className="pl-8 w-64" placeholder="Search…" onChange={(e) => setQuery(e.target.value)} />
      </div>
      <ViewToggle view={view} onChange={onChangeView} />
      <DropdownMenu>
        <DropdownMenuTrigger asChild><Button variant="outline" size="sm">Kinds</Button></DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="max-h-72 overflow-auto">
          {kindsInWorkspace.length === 0 ? (
            <DropdownMenuItem disabled>No kinds</DropdownMenuItem>
          ) : kindsInWorkspace.map(k => (
            <DropdownMenuItem key={k} onClick={() => toggleKind(k)}>{k}</DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

/* ===== Two-column body (icons added) ===== */
function BodyTwoColumn({ workspaceId, view }: { workspaceId: string; view: "grid" | "list" }) {
  const {
    ui, loading, filteredArtifacts, selectArtifact, refreshArtifact, selectedArtifactId, wsDoc,
  } = useRainaStore();

  // --- Category icon loader/cacher in webview state ---
  const [catIcons, setCatIcons] = useState<Record<string, string>>({});

  // Derive category keys from kinds: "cam.diagram.context" -> "diagram"
  const allCatKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const a of (wsDoc?.artifacts ?? [])) {
      const k = (a?.kind || "").split(".")[1];
      if (k) keys.add(k);
    }
    return Array.from(keys);
  }, [wsDoc?.artifacts]);

  useEffect(() => {
    const missing = allCatKeys.filter((k) => !catIcons[k]);
    if (!missing.length) return;
    (async () => {
      try {
        const arr = await callHost<{ key: string; icon_svg?: string }[]>({
          type: "categories:byKeys",
          payload: { keys: missing },
        });
        const map: Record<string, string> = { ...catIcons };
        (arr || []).forEach((c: any) => {
          if (c?.key && typeof c.icon_svg === "string") map[c.key] = c.icon_svg;
        });
        setCatIcons(map);
      } catch (e) {
        // silent fail; icons are cosmetic
        console.warn("[Artifacts] category icons fetch failed", e);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allCatKeys.join("|")]);

  const iconForKind = (kind?: string) => {
    const key = (kind || "").split(".")[1];
    const svg = (key && catIcons[key]) || DEFAULT_DOT_SVG;
    return <span className="shrink-0 text-neutral-300" dangerouslySetInnerHTML={{ __html: svg }} />;
  };

  if (ui.tab !== "artifacts") {
    if (ui.tab === "overview") {
      return (
        <div className="flex-1 overflow-auto">
          <div className="max-w-[1400px] mx-auto px-4 py-6">
            <Overview />
          </div>
        </div>
      );
    }
    if (ui.tab === "conversations") {
      return (
        <div className="max-w-[1400px] mx-auto px-4 py-6 text-sm text-neutral-400">
          Conversations (agent threads) coming soon…
        </div>
      );
    }
    if (ui.tab === "runs") {
      return (
        <div className="flex-1 min-h-0">
          <RunsTab workspaceId={workspaceId} />
        </div>
      );
    }
    if (ui.tab === "timeline") {
      return (
        <div className="max-w-[1400px] mx-auto px-4 py-6 text-sm text-neutral-400">
          Timeline coming soon…
        </div>
      );
    }
  }

  const list = filteredArtifacts();

  // Column proportions
  const colsClass =
    view === "grid"
      ? "lg:[grid-template-columns:minmax(0,1fr)_520px]"
      : "lg:[grid-template-columns:420px_minmax(0,1fr)]";

  return (
    <div className="flex-1 overflow-hidden min-h-0">
      <div
        className={[
          "max-w-[1400px] mx-auto w-full h-full px-4 py-4 grid grid-cols-1 gap-4 min-h-0",
          colsClass,
        ].join(" ")}
      >
        {/* Left column */}
        <div className="h-full overflow-auto pr-2 min-h-0">
          {loading && list.length === 0 ? (
            <div className="text-neutral-400 text-sm">Loading artifacts…</div>
          ) : list.length === 0 ? (
            <div className="text-neutral-400 text-sm">No artifacts match your filters.</div>
          ) : view === "grid" ? (
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
                      await selectArtifact(a.artifact_id);
                      await refreshArtifact(a.artifact_id);
                    }}
                    onKeyDown={async (e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        await selectArtifact(a.artifact_id);
                        await refreshArtifact(a.artifact_id);
                      }
                    }}
                  >
                    <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-neutral-400">
                      {iconForKind(a.kind)}
                      <span className="truncate">{a.kind}</span>
                    </div>
                    <div className="font-medium truncate mt-0.5">{a.name}</div>
                  </div>
                );
              })}
            </div>
          ) : (
            // List view
            <div className="flex flex-col gap-2">
              {list.map((a) => {
                const isSelected = selectedArtifactId === a.artifact_id;
                return (
                  <div
                    key={a.artifact_id}
                    role="button"
                    tabIndex={0}
                    aria-selected={isSelected}
                    className={[
                      "rounded-xl border px-3 py-2 transition outline-none cursor-pointer",
                      "bg-neutral-900/50 hover:bg-neutral-900",
                      isSelected ? "border-neutral-700 ring-1 ring-neutral-600" : "border-neutral-800",
                    ].join(" ")}
                    onClick={async () => {
                      await selectArtifact(a.artifact_id);
                      await refreshArtifact(a.artifact_id);
                    }}
                    onKeyDown={async (e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        await selectArtifact(a.artifact_id);
                        await refreshArtifact(a.artifact_id);
                      }
                    }}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-neutral-400 truncate">
                        {iconForKind(a.kind)}
                        <span className="truncate">{a.kind}</span>
                      </div>
                      <div className="font-medium truncate">{a.name}</div>
                    </div>
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

const DEFAULT_DOT_SVG =
  `<svg viewBox="0 0 24 24" width="16" height="16" xmlns="http://www.w3.org/2000/svg">
     <circle cx="12" cy="12" r="3" fill="currentColor"/>
   </svg>`;
