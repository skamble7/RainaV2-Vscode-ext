// src/components/workspace-detail/WorkspaceDetail.tsx
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useWorkspaceDetailStore } from "@/stores/useWorkspaceDetailStore"; // from the earlier plan

type Props = { workspaceId: string; onBack: () => void };

export default function WorkspaceDetail({ workspaceId, onBack }: Props) {
  const { detail, loading, load } = useWorkspaceDetailStore();

  useEffect(() => { load(workspaceId); }, [workspaceId, load]);

  // Escape to go back (nice little UX touch)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onBack(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onBack]);

  return (
    <div className="min-h-screen w-full">
      <div className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
        <div className="max-w-[1400px] mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" onClick={onBack}>← Back</Button>
          <div className="flex-1">
            <div className="text-xl font-semibold">
              {loading ? "Loading…" : detail?.workspace?.name ?? "Workspace"}
            </div>
            <div className="text-sm text-muted-foreground truncate">
              {detail?.workspace?.description}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-4 py-4">
        {loading ? (
          <div className="text-neutral-400 text-sm">Loading workspace…</div>
        ) : (
          <div className="text-neutral-300 text-sm">
            {/* Placeholder: replace with Overview/Artifacts tabs next */}
            {detail?.artifacts?.length
              ? `Artifacts: ${detail.artifacts.length}`
              : "No artifacts yet. Try “Discover”."}
          </div>
        )}
      </div>
    </div>
  );
}
