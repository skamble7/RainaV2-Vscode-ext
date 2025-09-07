/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useMemo } from "react";
import { useCapabilityStore } from "@/stores/useCapabilityStore";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, RefreshCw, Search, X } from "lucide-react";
import PackCard from "./PackCard";
import { vscode } from "@/lib/vscode";

export default function CapabilityPacksManager() {
  const loading = useCapabilityStore((s) => s.loading);
  const error = useCapabilityStore((s) => s.error);
  const q = useCapabilityStore((s) => s.q);
  const packs = useCapabilityStore((s) => s.packs);
  const selected = useCapabilityStore((s) => s.selectedPack);

  const setQ = useCapabilityStore((s) => s.setQ);
  const loadCaps = useCapabilityStore((s) => s.loadCaps);
  const loadPacks = useCapabilityStore((s) => s.loadPacks);
  const clearSelection = useCapabilityStore((s) => s.clearSelection);

  useEffect(() => {
    loadCaps().catch(() => null);
    loadPacks().catch(() => null);
  }, [loadCaps, loadPacks]);

  const body = useMemo(() => {
    if (loading && packs.length === 0)
      return <div className="text-neutral-400 text-sm">Loading…</div>;
    if (error) return <div className="text-red-400 text-sm">{error}</div>;
    if (!packs.length)
      return (
        <div className="text-neutral-400 text-sm">
          No capability packs yet. Create one.
        </div>
      );

    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {packs.map((p) => (
          <PackCard key={`${p.key}@${p.version}`} pack={p} />
        ))}
      </div>
    );
  }, [loading, error, packs]);

  const openNewDesigner = () => {
    vscode.postMessage({
      type: "packDesigner:open",
      payload: {}, // empty for new pack
    });
  };

  return (
    <div className="h-full w-full p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Capability Packs</h2>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-neutral-400" />
            <Input
              className="pl-8 w-64"
              placeholder="Search title/description…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") loadPacks().catch(() => null);
              }}
            />
          </div>
          <Button variant="secondary" onClick={() => loadPacks().catch(() => null)}>
            <RefreshCw className="h-4 w-4 mr-1" /> Refresh
          </Button>
          <Button onClick={openNewDesigner}>
            <Plus className="h-4 w-4 mr-1" /> New Pack
          </Button>
        </div>
      </div>

      <div className="mt-4">{body}</div>

      {selected && (
        <div className="fixed bottom-4 right-4">
          <Button size="sm" variant="outline" onClick={() => clearSelection()}>
            <X className="h-4 w-4 mr-1" /> Close details
          </Button>
        </div>
      )}
    </div>
  );
}
