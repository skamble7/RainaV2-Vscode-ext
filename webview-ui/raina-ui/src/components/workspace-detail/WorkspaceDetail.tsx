/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Search } from "lucide-react";
import { useWorkspaceDetailStore } from "@/stores/useWorkspaceDetailStore";
import ServiceCatalogRenderer from "./renderers/ServiceCatalogRenderer";

type Props = { workspaceId: string; onBack: () => void };

export default function WorkspaceDetail({ workspaceId, onBack }: Props) {
  const { load } = useWorkspaceDetailStore();
  useEffect(() => { load(workspaceId); }, [workspaceId, load]);

  return (
    <div className="w-screen min-h-screen flex flex-col">
      <HeaderBar onBack={onBack} />
      <TopFilterRow />
      <BodyTwoColumn />
    </div>
  );
}

/* ===== Header ===== */
function HeaderBar({ onBack }: { onBack: () => void }) {
  const { detail, loading, tab, setTab, updateWorkspaceMeta } = useWorkspaceDetailStore();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(detail?.workspace?.name ?? "");
  const [desc, setDesc] = useState(detail?.workspace?.description ?? "");

  useEffect(() => {
    if (!editing) {
      setName(detail?.workspace?.name ?? "");
      setDesc(detail?.workspace?.description ?? "");
    }
  }, [detail, editing]);

  return (
    <div className="sticky top-0 z-10 border-b bg-neutral-950/80 backdrop-blur">
      <div className="max-w-[1400px] mx-auto px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" onClick={onBack}>← Back</Button>

        <div className="flex-1 min-w-0">
          {editing ? (
            <div className="flex items-center gap-2">
              <Input className="max-w-md" value={name} onChange={(e) => setName(e.target.value)} />
              <Input placeholder="Description" value={desc} onChange={(e) => setDesc(e.target.value)} />
              <Button size="sm" onClick={async () => { await updateWorkspaceMeta({ name, description: desc }); setEditing(false); }}>Save</Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
            </div>
          ) : (
            <>
              <div className="text-xl font-semibold truncate">{loading ? "Loading…" : detail?.workspace?.name ?? "Workspace"}</div>
              <div className="text-sm text-neutral-400 truncate">{detail?.workspace?.description}</div>
            </>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button>Discover</Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Start discovery</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => {/* start default discovery */}}>Default Pack</DropdownMenuItem>
              <DropdownMenuItem disabled>Custom (soon)</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button variant="outline">Generate Guidance</Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>Architecture Guide</DropdownMenuItem>
              <DropdownMenuItem>Dev Hand-off</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button variant="ghost">Export</Button></DropdownMenuTrigger>
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

      <div className="max-w-[1400px] mx-auto px-4 pb-2">
        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="artifacts">Artifacts</TabsTrigger>
            <TabsTrigger value="conversations">Conversations</TabsTrigger>
            <TabsTrigger value="runs">Runs</TabsTrigger>
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
    </div>
  );
}

/* ===== Top filter row (replaces left rail) ===== */
function TopFilterRow() {
  const { setQuery, toggleKind, toggleDocType, counts } = useWorkspaceDetailStore();
  const c = counts();
  return (
    <div className="border-b border-neutral-800">
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
    </div>
  );
}

/* ===== Two-column body ===== */
function BodyTwoColumn() {
  const {
    tab, loading, filteredArtifacts, selectArtifact, refreshArtifact, openRight,
    selectedArtifactId, artifacts, draftById, startEdit, isDirty, saveDraft, cancelEdit, updateDraft,
  } = useWorkspaceDetailStore();

  const list = filteredArtifacts();
  const selected = useMemo(
    () => artifacts.find(a => a.artifact_id === selectedArtifactId),
    [artifacts, selectedArtifactId]
  );
  const draft = selected ? draftById[selected.artifact_id] : undefined;
  const dirty = selected ? isDirty(selected.artifact_id) : false;

  if (tab !== "artifacts") {
    // keep other tabs simple for now
    return (
      <div className="max-w-[1400px] mx-auto px-4 py-6 text-sm text-neutral-400">
        {tab === "overview" && <>Overview coming up…</>}
        {tab === "conversations" && <>Conversations (agent threads) coming soon…</>}
        {tab === "runs" && <>Runs list coming soon…</>}
        {tab === "timeline" && <>Timeline coming soon…</>}
      </div>
    );
  }

  return (
    <div className="max-w-[1400px] mx-auto w-full px-4 py-4 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_480px] gap-4">
      {/* Left: artifact list */}
      <div>
        {loading && list.length === 0 ? (
          <div className="text-neutral-400 text-sm">Loading artifacts…</div>
        ) : list.length === 0 ? (
          <div className="text-neutral-400 text-sm">No artifacts match your filters.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-2 gap-4">
            {list.map((a) => (
              <div key={a.artifact_id} className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-4 hover:bg-neutral-900 transition">
                <div className="text-xs uppercase tracking-wide text-neutral-400">{a.kind}</div>
                <div className="font-medium">{a.name}</div>
                <div className="text-xs text-neutral-400 mt-1">{describeArtifact(a)}</div>
                <div className="mt-3 flex gap-2">
                  <Button size="sm" variant="secondary" onClick={async () => {
                    selectArtifact(a.artifact_id);
                    await refreshArtifact(a.artifact_id);
                    openRight("details"); // persists right pane
                  }}>Open</Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Right: detail renderer */}
      <div className="rounded-2xl border border-neutral-800 bg-neutral-900/50 overflow-hidden">
        <div className="px-4 py-3 border-b border-neutral-800 flex items-center justify-between">
          <div className="text-sm font-medium truncate">{selected?.name ?? "Select an artifact"}</div>
          {selected && (
            <div className="flex items-center gap-2">
              {!draft && <Button size="sm" variant="outline" onClick={() => startEdit(selected.artifact_id)}>Edit</Button>}
              {draft && (
                <>
                  <Button size="sm" onClick={() => saveDraft(selected.artifact_id)}>Save</Button>
                  <Button size="sm" variant="ghost" onClick={() => cancelEdit(selected.artifact_id)}>Cancel</Button>
                </>
              )}
              <Button size="sm" variant="ghost" onClick={() => selected && refreshArtifact(selected.artifact_id)}>Refresh</Button>
            </div>
          )}
        </div>

        <div className="p-4 max-h-[70vh] overflow-auto text-sm">
          {!selected ? (
            <div className="text-neutral-400">Pick an artifact from the list.</div>
          ) : (
            <ArtifactRenderer
              artifact={selected}
              draft={draft}
              dirty={dirty}
              onDraftChange={(fn) => updateDraft(selected.artifact_id, fn)}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/* ===== Dispatcher to friendly renderers ===== */
function ArtifactRenderer({
  artifact, draft, dirty, onDraftChange,
}: { artifact: any; draft: any; dirty: boolean; onDraftChange: (fn: (d: any) => void) => void }) {
  const data = draft ?? artifact.data;

  // Service Catalog
  if (artifact.kind === "cam.document" && data?.doc_type === undefined && Array.isArray(data?.services)) {
    return (
      <ServiceCatalogRenderer
        data={data}
        editable={!!draft}
        onChange={(next: { services: any; }) => onDraftChange((d) => { d.services = next.services; })}
      />
    );
  }

  // Event Catalog, NFR Matrix, etc. will come next — for now fallback:
  return (
    <div className="space-y-2">
      <div className="text-neutral-400">No specialized renderer yet. Showing JSON preview.</div>
      <pre className="text-xs bg-neutral-950/60 rounded p-2 overflow-auto">{safePreview(data)}</pre>
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

function safePreview(data: unknown) {
  try { return JSON.stringify(data, null, 2); } catch { return String(data); }
}
