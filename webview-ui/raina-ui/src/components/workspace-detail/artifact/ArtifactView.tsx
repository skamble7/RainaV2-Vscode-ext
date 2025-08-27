/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { useRainaStore } from "@/stores/useRainaStore";
import { ArtifactRenderer } from "../renderers";
import AutoForm from "../renderers/AutoForm";

const fmtDate = (iso?: string) => (iso ? new Date(iso).toLocaleString() : "—");
const fmtVersion = (v: any) =>
  v == null
    ? "1"
    : typeof v === "number"
    ? String(v)
    : typeof v === "object" && typeof v.$numberInt === "string"
    ? v.$numberInt
    : String(v);

export default function ArtifactView() {
  const {
    artifacts, selectedArtifactId, draftById,
    startEdit, cancelEdit, updateDraft, isDirty, saveDraft, refreshArtifact,
  } = useRainaStore();

  const a = useMemo(
    () => artifacts.find((x) => x.artifact_id === selectedArtifactId),
    [artifacts, selectedArtifactId]
  );
  const draft = a ? draftById[a.artifact_id] : undefined;
  const dirty = a ? isDirty(a.artifact_id) : false;

  return (
    <div className="h-full min-h-0 flex flex-col">
      {/* toolbar */}
      <div className="px-4 py-3 border-b border-neutral-800 flex items-center justify-between shrink-0">
        <div className="min-w-0">
          <div className="text-base font-semibold truncate">{a?.name ?? "Select an artifact"}</div>
          {a && (
            <div className="text-xs text-neutral-400 truncate">
              <code>{a.kind}</code> · v{fmtVersion(a.version)} · updated {fmtDate(a?.updated_at)}
            </div>
          )}
        </div>
        {a && (
          <div className="flex items-center gap-2">
            {!draft && <Button size="sm" variant="outline" onClick={() => startEdit(a.artifact_id)}>Edit</Button>}
            {draft && (
              <>
                <Button size="sm" onClick={() => saveDraft(a.artifact_id)}>Save</Button>
                <Button size="sm" variant="ghost" onClick={() => cancelEdit(a.artifact_id)}>Cancel</Button>
              </>
            )}
            <Button size="sm" variant="ghost" onClick={() => refreshArtifact(a.artifact_id)}>Refresh</Button>
          </div>
        )}
      </div>

      {/* body */}
      <div className="p-4 flex-1 min-h-0">
        {!a ? (
          <div className="text-sm text-neutral-400">Pick an artifact from the list.</div>
        ) : (
          <>
            {a.provenance && (
              <div className="text-xs text-neutral-500 mb-3">
                {a.provenance.agent && <span className="mr-3">agent: {a.provenance.agent}</span>}
                {a.provenance.capability_pack && <span className="mr-3">pack: {a.provenance.capability_pack}</span>}
                {a.provenance.author && <span className="mr-3">author: {a.provenance.author}</span>}
              </div>
            )}

            {draft ? (
              <AutoForm
                kind={a.kind}
                value={draft}
                onChangeAt={(mut) => updateDraft(a.artifact_id, mut)}
              />
            ) : (
              <ArtifactRenderer kind={a.kind} data={a.data} editable={false} onChange={() => {}} />
            )}

            {draft && !dirty && <div className="text-xs text-amber-400 mt-3">No changes yet.</div>}
          </>
        )}
      </div>
    </div>
  );
}
