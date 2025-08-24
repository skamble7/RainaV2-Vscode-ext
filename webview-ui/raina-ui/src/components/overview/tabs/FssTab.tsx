// src/components/overview/tabs/FssTab.tsx
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import AddFeatureDrawer from "./AddFeatureDrawer";

export type StoryItem = {
  key: string;
  title?: string;
  description?: string;
  acceptance_criteria?: string[];
  tags?: string[];
};

type Props = {
  stories: StoryItem[];
  /** Called after a delta run is successfully kicked off */
  onRunStarted?: () => void;
};

export default function FssTab({ stories, onRunStarted }: Props) {
  const [open, setOpen] = useState(false);

  const sorted = useMemo(
    () =>
      [...(stories ?? [])].sort((a, b) => {
        // Try to sort numerically by trailing digits in key
        const na = Number((a.key || "").match(/\d+$/)?.[0] ?? Number.MAX_SAFE_INTEGER);
        const nb = Number((b.key || "").match(/\d+$/)?.[0] ?? Number.MAX_SAFE_INTEGER);
        return na - nb;
      }),
    [stories]
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center">
        <div className="text-sm text-neutral-400">
          Showing current baseline features ({sorted.length})
        </div>
        <div className="ml-auto">
          <Button onClick={() => setOpen(true)}>Add feature</Button>
        </div>
      </div>

      <div className="space-y-3">
        {sorted.map((s) => (
          <Card key={s.key} className="bg-neutral-900 border-neutral-800">
            <CardContent className="p-4">
              <div className="text-xs text-neutral-400 font-mono">{s.key}</div>
              <div className="text-lg font-semibold">{s.title}</div>
              {s.description ? (
                <div className="text-sm text-neutral-400 mt-0.5">{s.description}</div>
              ) : null}

              {Array.isArray(s.acceptance_criteria) && s.acceptance_criteria.length > 0 && (
                <ul className="mt-3 list-disc pl-5 space-y-1 text-sm text-neutral-300">
                  {s.acceptance_criteria.map((c, i) => (
                    <li key={i}>{c}</li>
                  ))}
                </ul>
              )}

              {Array.isArray(s.tags) && s.tags.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {s.tags.map((t, i) => (
                    <Badge key={`${t}-${i}`} variant="secondary" className="bg-neutral-800">
                      {t}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}

        {sorted.length === 0 && (
          <div className="text-sm text-neutral-400">No features in baseline yet.</div>
        )}
      </div>

      {/* Drawer for creating a new story (delta run) */}
      <AddFeatureDrawer open={open} onOpenChange={setOpen} onRunStarted={onRunStarted} />
    </div>
  );
}
