/* eslint-disable @typescript-eslint/no-explicit-any */
// src/components/workspace/ViewToggle.tsx
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import { Button } from "@/components/ui/button";
import { Grid, List } from "lucide-react";

export default function ViewToggle() {
  const view = useWorkspaceStore((s: { view: any; }) => s.view);
  const setView = useWorkspaceStore((s: { setView: any; }) => s.setView);

  return (
    <div className="flex items-center gap-1">
      <Button
        variant={view === "grid" ? "default" : "ghost"}
        size="icon"
        onClick={() => setView("grid")}
        className="rounded-2xl"
        title="Grid view"
      >
        <Grid className="h-4 w-4" />
      </Button>
      <Button
        variant={view === "list" ? "default" : "ghost"}
        size="icon"
        onClick={() => setView("list")}
        className="rounded-2xl"
        title="List view"
      >
        <List className="h-4 w-4" />
      </Button>
    </div>
  );
}
