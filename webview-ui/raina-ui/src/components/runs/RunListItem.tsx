/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, Trash2 } from "lucide-react";
import { countsOf } from "./utils";
import { DeltaPill, StatusBadge } from "./Badges";
import type { DiscoveryRun } from "@/stores/useRunsStore";

type Props = {
  run: DiscoveryRun;
  selected: boolean;
  onSelect: (runId: string) => void;
  onRefresh: (runId: string) => void;
  onDelete: (runId: string) => void;
};

export default function RunListItem({
  run,
  selected,
  onSelect,
  onRefresh,
  onDelete,
}: Props) {
  const title = run.title || run.result_summary?.title || run.run_id;
  const desc = run.description || run.result_summary?.description || "";
  const counts = countsOf(run);

  return (
    <li className="my-1">
      <div
        role="button"
        tabIndex={0}
        onClick={() => onSelect(run.run_id)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSelect(run.run_id);
          }
        }}
        className={[
          "relative w-full rounded-lg border transition p-3",
          "cursor-pointer text-left",
          selected
            ? "border-neutral-700 bg-neutral-900/80 ring-1 ring-neutral-600"
            : "border-neutral-800 bg-neutral-900/40 hover:bg-neutral-900",
          "min-h-[76px] pr-20",
        ].join(" ")}
      >
        {/* actions */}
        <div className="absolute right-2 top-2 flex gap-1">
          <Button
            size="icon"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              onRefresh(run.run_id);
            }}
            title="Refresh run"
          >
            <RefreshCw size={16} />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(run.run_id);
            }}
            title="Delete run"
          >
            <Trash2 size={16} />
          </Button>
        </div>

        {/* content */}
        <div className="min-w-0">
          <div className="truncate font-medium">{title}</div>
          {!!desc && <div className="truncate text-xs text-neutral-400">{desc}</div>}

          <div className="mt-1 flex items-center gap-2 text-[11px] text-neutral-400">
            <span className="font-mono">{run.playbook_id}</span>
            <span>•</span>
            <StatusBadge status={run.status} />
          </div>

          <div className="mt-2 flex flex-wrap gap-1.5">
            <DeltaPill label="new" value={counts.new} tone="emerald" />
            <DeltaPill label="updated" value={counts.updated} tone="sky" />
            <DeltaPill label="unchanged" value={counts.unchanged} tone="neutral" />
            <DeltaPill label="retired" value={counts.retired} tone="amber" />
            <DeltaPill label="deleted" value={counts.deleted} tone="red" />
          </div>
        </div>
      </div>
    </li>
  );
}
