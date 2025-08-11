/* eslint-disable @typescript-eslint/no-explicit-any */
// src/components/workspace-detail/dialogs/ReplaceDialog.tsx
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";
import { useWorkspaceDetailStore } from "@/stores/useWorkspaceDetailStore";

export default function ReplaceDialog({
  open, onOpenChange, artifact,
}: { open: boolean; onOpenChange: (v: boolean) => void; artifact: any }) {
  const { replaceArtifact, refreshArtifact } = useWorkspaceDetailStore();
  const [text, setText] = useState(JSON.stringify(artifact?.data ?? {}, null, 2));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async () => {
    setSaving(true); setError(null);
    try {
      const payload = JSON.parse(text);
      const res = await replaceArtifact(artifact.artifact_id, payload, { author: "ui", reason: "manual replace" });
      if (res === "conflict") {
        setError("Conflict (ETag). Refreshed latest data. Please retry.");
        await refreshArtifact(artifact.artifact_id);
      } else {
        onOpenChange(false);
      }
    } catch (e: any) {
      setError(e?.message ?? "Invalid JSON or replace failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Replace entire data</DialogTitle>
        </DialogHeader>
        <Textarea rows={14} value={text} onChange={(e) => setText(e.target.value)} />
        {error && <div className="text-red-400 text-xs">{error}</div>}
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={onSubmit} disabled={saving}>{saving ? "Saving…" : "Replace"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
