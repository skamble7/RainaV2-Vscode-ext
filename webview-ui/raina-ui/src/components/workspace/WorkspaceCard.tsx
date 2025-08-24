// src/components/workspace/WorkspaceCard.tsx
import { Card, CardContent } from "@/components/ui/card";
import { MoreHorizontal } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { WorkspaceSummary } from "@/types/workspace";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import clsx from "clsx";

type Props = {
    workspace: WorkspaceSummary;
    variant?: "grid" | "list";
};

export default function WorkspaceCard({ workspace, variant = "grid" }: Props) {
    const select = useWorkspaceStore((s) => s.select);

    return (
        <Card
            className={clsx(
                "bg-neutral-900/60 hover:bg-neutral-900 transition-colors border-neutral-800 cursor-pointer",
                "rounded-2xl"
            )}
            onClick={() => {
                console.log("Selecting", workspace.id);
                select(workspace.id)
            }}
        >
            <CardContent className={clsx("p-5", variant === "list" && "py-4")}>
                <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                        <div className="text-base font-medium">{workspace.name}</div>
                        {workspace.description && (
                            <div className="text-sm text-neutral-400 line-clamp-2">{workspace.description}</div>
                        )}
                    </div>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <button className="p-1.5 rounded-lg hover:bg-neutral-800">
                                <MoreHorizontal className="h-4 w-4" />
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => select(workspace.id)}>Open</DropdownMenuItem>
                            <DropdownMenuItem disabled>Edit (soon)</DropdownMenuItem>
                            <DropdownMenuItem className="text-red-500" disabled>Delete (soon)</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </CardContent>
        </Card>
    );
}
