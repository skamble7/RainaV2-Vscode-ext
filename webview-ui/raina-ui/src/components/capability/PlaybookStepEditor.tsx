/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";

type Step = {
  id: string;
  name?: string;
  description?: string;
  capability_id: string;
  params?: any;
};

type Cap = { id: string; name: string };

export default function PlaybookStepEditor({
  step,
  capabilities,
  onChange,
  onDelete,
}: {
  step: Step;
  capabilities: Cap[];
  onChange: (next: Step) => void;
  onDelete: () => void;
}) {
  const update = (patch: Partial<Step>) => onChange({ ...step, ...patch });

  return (
    <div className="border border-neutral-700 rounded-lg p-3 space-y-2">
      <div className="flex justify-between items-center">
        <Input
          className="font-medium text-base"
          placeholder="Step name"
          value={step.name ?? ""}
          onChange={(e) => update({ name: e.target.value })}
        />
        <Button variant="destructive" size="icon" onClick={onDelete} title="Delete step">
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <Textarea
        placeholder="Step description"
        value={step.description ?? ""}
        onChange={(e) => update({ description: e.target.value })}
        rows={2}
      />

      <div>
        <label className="text-xs text-neutral-400">Capability</label>
        <Select
          value={step.capability_id}
          onValueChange={(v) => update({ capability_id: v })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Choose capability…" />
          </SelectTrigger>
          <SelectContent>
            {capabilities.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name} <span className="text-xs text-neutral-500">({c.id})</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <label className="text-xs text-neutral-400">Params (JSON)</label>
        <Textarea
          placeholder="{ }"
          rows={3}
          value={JSON.stringify(step.params ?? {}, null, 2)}
          onChange={(e) => {
            try {
              const parsed = JSON.parse(e.target.value);
              update({ params: parsed });
            } catch {
              // ignore parse errors until valid
            }
          }}
        />
      </div>
    </div>
  );
}
