/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from "react";
import { useRainaStore } from "@/stores/useRainaStore";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PatchDialog from "./dialogs/PatchDialog.tsx";
import ReplaceDialog from "./dialogs/ReplaceDialog.tsx";
import DeleteDialog from "./dialogs/DeleteDialog.tsx";

export default function RightPane() {
  const {
    ui,
    closeRight,
    selectedArtifactId,
    artifacts,
    refreshArtifact,
    loadArtifactHistory,
    wsDoc,
  } = useRainaStore();

  const { rightOpen, rightMode } = ui;

  const [tab, setTab] = useState<"details"|"edit"|"history"|"agent">(rightMode === "agent" ? "agent" : "details");
  useEffect(() => { if (rightMode === "agent") setTab("agent"); }, [rightMode]);

  const artifact = useMemo(
    () => artifacts.find((a) => a.artifact_id === selectedArtifactId),
    [artifacts, selectedArtifactId]
  );

  const [showPatch, setShowPatch] = useState(false);
  const [showReplace, setShowReplace] = useState(false);
  const [showDelete, setShowDelete] = useState(false);

  const [history, setHistory] = useState<any[] | null>(null);
  useEffect(() => {
    if (tab === "history" && selectedArtifactId) {
      loadArtifactHistory(selectedArtifactId).then(setHistory).catch(() => setHistory([]));
    }
  }, [tab, selectedArtifactId, loadArtifactHistory]);

  if (!rightOpen) return null;

  return (
    <aside className="w-96 shrink-0 border-l border-neutral-800 h-full flex flex-col">
      <div className="px-3 py-2 border-b border-neutral-800 flex items-center justify-between">
        <div className="text-sm font-medium">{artifact?.name ?? "No selection"}</div>
        <Button size="sm" variant="ghost" onClick={closeRight}>Close</Button>
      </div>

      <div className="px-3 pt-2">
        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="edit">Edit</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
            <TabsTrigger value="agent">Agent</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="flex-1 overflow-auto p-3">
        {tab === "details" && <Details artifact={artifact} onRefresh={() => artifact && refreshArtifact(artifact.artifact_id)} />}
        {tab === "edit" && artifact && (
          <EditPanel
            onPatch={() => setShowPatch(true)}
            onReplace={() => setShowReplace(true)}
            onDelete={() => setShowDelete(true)}
          />
        )}
        {tab === "history" && <HistoryPanel history={history} />}
        {tab === "agent" && <AgentConsole workspaceName={wsDoc?.workspace?.name} />}
      </div>

      {artifact && (
        <>
          <PatchDialog open={showPatch} onOpenChange={setShowPatch} artifact={artifact} />
          <ReplaceDialog open={showReplace} onOpenChange={setShowReplace} artifact={artifact} />
          <DeleteDialog open={showDelete} onOpenChange={setShowDelete} artifact={artifact} />
        </>
      )}
    </aside>
  );
}

function Details({ artifact, onRefresh }: { artifact: any; onRefresh: () => void }) {
  if (!artifact) return <div className="text-sm text-neutral-400">Select an artifact to view details.</div>;
  return (
    <div className="space-y-2 text-sm">
      <div className="text-xs uppercase tracking-wide text-neutral-400">{artifact.kind}</div>
      <div className="font-medium">{artifact.name}</div>
      <div className="text-neutral-400">Version: {String(artifact.version ?? "1")}</div>
      <div className="flex gap-2 mt-2">
        <Button size="sm" variant="outline" onClick={onRefresh}>Refresh</Button>
      </div>
      <pre className="mt-3 text-xs bg-neutral-950/60 rounded p-2 overflow-auto">
        {safePreview(artifact.data)}
      </pre>
    </div>
  );
}

function EditPanel({ onPatch, onReplace, onDelete }: { onPatch: () => void; onReplace: () => void; onDelete: () => void }) {
  return (
    <div className="space-y-2 text-sm">
      <div className="text-neutral-400">
        Use <span className="font-medium">JSON Patch</span> for focused edits (ETag safe), or <span className="font-medium">Replace</span> to overwrite the whole <code>data</code>.
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={onPatch}>Patch data</Button>
        <Button size="sm" variant="outline" onClick={onReplace}>Replace data</Button>
        <Button size="sm" variant="destructive" onClick={onDelete}>Delete</Button>
      </div>
      <div className="text-xs text-neutral-500 mt-2">
        Tip: Patch paths start at <code>/</code> inside <code>data</code> (e.g. <code>/relationships/2/notes</code>).
      </div>
    </div>
  );
}

function HistoryPanel({ history }: { history: any[] | null }) {
  if (history === null) return <div className="text-sm text-neutral-400">Loading history…</div>;
  if (history.length === 0) return <div className="text-sm text-neutral-400">No history.</div>;
  return (
    <div className="space-y-3 text-sm">
      {history.map((h, i) => (
        <div key={i} className="rounded border border-neutral-800 p-2">
          <div className="text-xs text-neutral-500">{h?.ts ?? h?.timestamp ?? ""}</div>
          <div className="font-medium">{h?.op ?? h?.operation ?? "patch"}</div>
          {h?.patch && <pre className="text-xs mt-1 bg-neutral-950/60 p-2 rounded overflow-auto">{JSON.stringify(h.patch, null, 2)}</pre>}
          {h?.provenance && <div className="text-xs text-neutral-500 mt-1">by {h.provenance?.author ?? h.provenance?.agent}</div>}
        </div>
      ))}
    </div>
  );
}

function AgentConsole({ workspaceName }: { workspaceName?: string }) {
  return (
    <div className="text-sm text-neutral-400">
      Live discovery/guidance logs for <span className="text-neutral-300">{workspaceName}</span> will appear here…
    </div>
  );
}

function safePreview(data: unknown) {
  try { return JSON.stringify(data, null, 2); } catch { return String(data); }
}
