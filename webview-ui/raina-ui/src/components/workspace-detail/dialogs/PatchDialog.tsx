/* eslint-disable @typescript-eslint/no-explicit-any */
// src/components/workspace-detail/dialogs/PatchDialog.tsx
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";
import { useWorkspaceDetailStore } from "@/stores/useWorkspaceDetailStore";

export default function PatchDialog({
  open, onOpenChange, artifact,
}: { open: boolean; onOpenChange: (v: boolean) => void; artifact: any }) {
  const { patchArtifact, refreshArtifact } = useWorkspaceDetailStore();
  const [text, setText] = useState(
    JSON.stringify([{ op: "replace", path: "/title", value: "New Title" }], null, 2)
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async () => {
    setSaving(true); setError(null);
    try {
      const patch = JSON.parse(text);
      const res = await patchArtifact(artifact.artifact_id, patch, { author: "ui", reason: "manual patch" });
      if (res === "conflict") {
        setError("Conflict (ETag). Refreshed latest data. Please re-apply your change.");
        await refreshArtifact(artifact.artifact_id);
      } else {
        onOpenChange(false);
      }
    } catch (e: any) {
      setError(e?.message ?? "Invalid JSON or patch failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Patch data (JSON Patch)</DialogTitle>
        </DialogHeader>
        <div className="text-xs text-neutral-500">
          Paths start at <code>/</code> inside <code>data</code>. Example for context map notes:
          <pre className="bg-neutral-950/60 p-2 rounded mt-1 overflow-auto">{`[
  { "op":"replace", "path":"/relationships/2/notes", "value":"New note" }
]`}</pre>
        </div>
        <Textarea rows={12} value={text} onChange={(e) => setText(e.target.value)} />
        {error && <div className="text-red-400 text-xs">{error}</div>}
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={onSubmit} disabled={saving}>{saving ? "Saving…" : "Apply patch"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
