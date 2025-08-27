/* eslint-disable @typescript-eslint/no-explicit-any */
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useRainaStore } from "@/stores/useRainaStore";
import { useState } from "react";

export default function DeleteDialog({
  open, onOpenChange, artifact,
}: { open: boolean; onOpenChange: (v: boolean) => void; artifact: any }) {
  const { deleteArtifact } = useRainaStore();
  const [busy, setBusy] = useState(false);

  const onConfirm = async () => {
    setBusy(true);
    try {
      await deleteArtifact(artifact.artifact_id);
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Delete artifact?</DialogTitle></DialogHeader>
        <div className="text-sm">
          This will soft-delete <span className="font-medium">{artifact?.name}</span>. You can re-include deleted items via filters later.
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button variant="destructive" onClick={onConfirm} disabled={busy}>{busy ? "Deleting…" : "Delete"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
