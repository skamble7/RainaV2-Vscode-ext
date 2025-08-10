/* eslint-disable @typescript-eslint/no-explicit-any */
// src/components/workspace/NewWorkspaceDrawer.tsx
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetFooter, SheetClose } from "@/components/ui/sheet";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import { Plus } from "lucide-react";

export default function NewWorkspaceDrawer() {
  const create = useWorkspaceStore((s: { create: any; }) => s.create);
  const loading = useWorkspaceStore((s: { loading: any; }) => s.loading);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  async function onCreate() {
    if (!name.trim()) return;
    await create({ name: name.trim(), description: description.trim() || undefined, created_by: "raina" });
    setOpen(false);
    setName("");
    setDescription("");
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
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
            <Input id="ws-name" placeholder="e.g., CardDemo Modernization" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ws-desc">Description</Label>
            <Textarea id="ws-desc" placeholder="Short description…" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
        </div>
        <SheetFooter className="mt-6">
          <SheetClose asChild>
            <Button variant="ghost">Cancel</Button>
          </SheetClose>
          <Button onClick={onCreate} disabled={!name.trim() || loading}>
            {loading ? "Creating…" : "Create"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
