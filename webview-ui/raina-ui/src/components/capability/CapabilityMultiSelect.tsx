/* eslint-disable @typescript-eslint/no-unused-expressions */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useMemo, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

type Cap = { id: string; name: string; description?: string; tags?: string[] };

export default function CapabilityMultiSelect({
  capabilities,
  selected,
  onChange,
}: {
  capabilities: Cap[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const [q, setQ] = useState("");

  const items = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return capabilities
      .filter((c) => {
        if (!needle) return true;
        const hay = `${c.id} ${c.name} ${(c.tags || []).join(" ")}`.toLowerCase();
        return hay.includes(needle);
      })
      .slice(0, 200);
  }, [capabilities, q]);

  const toggle = (id: string) => {
    const set = new Set(selected);
    set.has(id) ? set.delete(id) : set.add(id);
    onChange(Array.from(set));
  };

  return (
    <div className="border border-neutral-800 rounded-xl p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="font-medium text-sm">Select capabilities</div>
        <Input className="w-48 h-8" placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="max-h-56 overflow-auto pr-1 space-y-2">
        {items.map((c) => (
          <label key={c.id} className="flex items-start gap-2 text-sm">
            <Checkbox checked={selected.includes(c.id)} onCheckedChange={() => toggle(c.id)} />
            <div>
              <div className="font-medium">{c.name} <span className="text-xs text-neutral-400">({c.id})</span></div>
              {c.tags?.length ? (
                <div className="flex flex-wrap gap-1 mt-1">
                  {c.tags.slice(0, 6).map((t) => <Badge key={t} variant="secondary" className="text-[10px]">{t}</Badge>)}
                </div>
              ) : null}
            </div>
          </label>
        ))}
      </div>
    </div>
  );
}
