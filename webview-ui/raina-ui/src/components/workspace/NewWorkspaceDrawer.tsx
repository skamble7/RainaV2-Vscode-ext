/* eslint-disable @typescript-eslint/no-explicit-any */
//webview-ui/raina-ui/src/components/workspace/NewWorkspaceDrawer.tsx
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
  SheetClose,
} from "@/components/ui/sheet";
import { Plus } from "lucide-react";
import { callHost } from "@/lib/host";
import type { WorkspaceSummary } from "@/types/workspace";

type Props = {
  onCreated?: (ws: WorkspaceSummary) => void;
};

export default function NewWorkspaceDrawer({ onCreated }: Props) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  async function onCreate() {
    if (!name.trim() || creating) return;
    setCreating(true);
    try {
      const ws = await callHost<WorkspaceSummary>({
        type: "workspace:create",
        payload: { name: name.trim(), description: description.trim() || undefined, created_by: "raina" },
      });
      onCreated?.(ws);
      setOpen(false);
      setName("");
      setDescription("");
    } finally {
      setCreating(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !creating && setOpen(v)}>
      <SheetTrigger asChild>
        <Button className="rounded-2xl">
          <Plus className="h-4 w-4 mr-2" /> New Workspace
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[420px]">
        <SheetHeader>
          <SheetTitle>Create Workspace</SheetTitle>
        </SheetHeader>
        <div className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ws-name">Name</Label>
            <Input
              id="ws-name"
              placeholder="e.g., CardDemo Modernization"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={creating}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ws-desc">Description</Label>
            <Textarea
              id="ws-desc"
              placeholder="Short description…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={creating}
            />
          </div>
        </div>
        <SheetFooter className="mt-6">
          <SheetClose asChild>
            <Button variant="ghost" disabled={creating}>Cancel</Button>
          </SheetClose>
          <Button onClick={onCreate} disabled={!name.trim() || creating}>
            {creating ? "Creating…" : "Create"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
