/* eslint-disable @typescript-eslint/no-explicit-any */
// src/components/workspace/ViewToggle.tsx
import { Button } from "@/components/ui/button";
import { Grid, List } from "lucide-react";

type Props = {
  view: "grid" | "list";
  onChange: (v: "grid" | "list") => void;
};

export default function ViewToggle({ view, onChange }: Props) {
  return (
    <div className="flex items-center gap-1">
      <Button
        variant={view === "grid" ? "default" : "ghost"}
        size="icon"
        onClick={() => onChange("grid")}
        className="rounded-2xl"
        title="Grid view"
      >
        <Grid className="h-4 w-4" />
      </Button>
      <Button
        variant={view === "list" ? "default" : "ghost"}
        size="icon"
        onClick={() => onChange("list")}
        className="rounded-2xl"
        title="List view"
      >
        <List className="h-4 w-4" />
      </Button>
    </div>
  );
}

