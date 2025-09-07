/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trash2, ArrowRight, FileText, Layers } from "lucide-react";
import { useCapabilityStore } from "@/stores/useCapabilityStore";
import { vscode } from "@/lib/vscode";

type Props = {
  pack: {
    key: string;
    version: string;
    title: string;
    description?: string;
    capability_ids: string[];
    playbooks: any[];
    updated_at?: string;
  };
};

export default function PackCard({ pack }: Props) {
  const deletePack = useCapabilityStore((s) => s.deletePack);

  const openDesigner = () => {
    vscode.postMessage({
      type: "packDesigner:open",
      payload: { key: pack.key, version: pack.version },
    });
  };

  return (
    <Card className="bg-neutral-900/40 border-neutral-800 hover:bg-neutral-900/60 transition">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-sm text-neutral-400">
              {pack.key}@{pack.version}
            </div>
            <div className="text-base font-medium">{pack.title}</div>
            {pack.description && (
              <div className="text-xs text-neutral-400 mt-1 line-clamp-2">
                {pack.description}
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <Badge variant="secondary" className="text-xs">
              <Layers className="h-3 w-3 mr-1" /> {pack.capability_ids?.length ?? 0}
            </Badge>
            <Badge variant="secondary" className="text-xs">
              <FileText className="h-3 w-3 mr-1" /> {pack.playbooks?.length ?? 0}
            </Badge>
          </div>
        </div>

        <div className="flex items-center gap-2 mt-3">
          <Button size="sm" onClick={openDesigner}>
            Open <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => deletePack(pack.key, pack.version)}
            className="ml-auto"
            title="Delete pack"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
