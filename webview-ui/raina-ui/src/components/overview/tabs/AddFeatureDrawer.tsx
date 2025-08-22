// src/components/overview/tabs/AddFeatureDrawer.tsx
/* eslint-disable @typescript-eslint/no-explicit-any */
import * as React from "react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
  DrawerClose,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useWorkspaceDetailStore } from "@/stores/useWorkspaceDetailStore";
import { useRunsStore } from "@/stores/useRunsStore";
import type { StoryItem } from "./FssTab";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Optional: prefill story fields when drawer opens */
  defaultStory?: StoryItem;
  /** Notify parent (Overview) to switch to the "runs" tab */
  onRunStarted?: () => void;
};

/** Requested default data for new delta runs */
const DEFAULT_PREFILL: StoryItem = {
  key: "CARD-120",
  title: "As a compliance officer, I can view PCI dashboards",
  description: "Provide PCI-KPI cards and export",
  acceptance_criteria: ["KPI cards load", "Export to CSV"],
  tags: ["domain:reporting", "capability:compliance"],
};

// Try to infer pack/model from any existing artifact provenance
function inferPackAndModel(detail: any): {
  pack_key?: string;
  pack_version?: string;
  model?: string;
} {
  try {
    const arts: any[] = Array.isArray(detail?.artifacts) ? detail.artifacts : [];
    for (const a of arts) {
      const pk = a?.provenance?.pack_key as string | undefined;
      const pv = a?.provenance?.pack_version as string | undefined;
      const model = a?.provenance?.model_id as string | undefined;
      if (pk && pv) return { pack_key: pk, pack_version: pv, model };
    }
  } catch {
    /* ignore */
  }
  return {};
}

export default function AddFeatureDrawer({ open, onOpenChange, defaultStory, onRunStarted }: Props) {
  const runs = useRunsStore();
  const { detail } = useWorkspaceDetailStore();

  const workspaceId =
    detail?.workspace_id ?? (detail?.workspace?._id as string | undefined);

  // Initialize & reset with defaults each time the drawer opens
  const [form, setForm] = React.useState<StoryItem>(defaultStory ?? DEFAULT_PREFILL);
  React.useEffect(() => {
    if (open) {
      // Use caller-supplied defaults if provided; otherwise use required prefill
      setForm(defaultStory ?? DEFAULT_PREFILL);
    }
  }, [open, defaultStory]);

  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | undefined>();

  const onChange = (patch: Partial<StoryItem>) => setForm((f) => ({ ...f, ...patch }));

  const handleSubmit = async () => {
    if (!workspaceId) {
      setError("Missing workspace id.");
      return;
    }
    setError(undefined);
    setSubmitting(true);
    try {
      // --- Build inputs strictly from the baseline ---
      const baseline = (detail as any)?.inputs_baseline ?? {};
      const avc = baseline?.avc ?? {};
      const pss = baseline?.pss ?? {};
      const baselineStories: StoryItem[] = Array.isArray(baseline?.fss?.stories)
        ? baseline.fss.stories
        : [];

      // Form story normalization
      const story: StoryItem = {
        key: (form.key ?? "").trim(),
        title: (form.title ?? "").trim(),
        description: (form.description ?? "").trim(),
        acceptance_criteria: (form.acceptance_criteria ?? [])
          .map((x) => String(x).trim())
          .filter(Boolean),
        tags: (form.tags ?? []).map((x) => String(x).trim()).filter(Boolean),
      };

      // Infer capability pack + model from existing artifacts’ provenance
      const inferred = inferPackAndModel(detail);

      const requestBody = {
        playbook_id: "pb.micro.plus",
        workspace_id: workspaceId, // required
        title: story.key ? `Add ${story.key}` : "Delta feature",
        description: story.title || "Delta feature",
        inputs: {
          avc, // required by backend
          fss: { stories: [...baselineStories, story] },
          pss, // required by backend
        },
        options: {
          validate: true,
          dry_run: false,
          ...(inferred.pack_key ? { pack_key: inferred.pack_key } : {}),
          ...(inferred.pack_version ? { pack_version: inferred.pack_version } : {}),
          ...(inferred.model ? { model: inferred.model } : {}),
        },
      };

      // Start the run (reuses extension plumbing)
      await runs.start(workspaceId, requestBody);

      // Notify parent to switch to Runs tab
      onRunStarted?.();

      setSubmitting(false);
      onOpenChange(false);
    } catch (e: any) {
      setSubmitting(false);
      setError(e?.message ?? "Failed to start delta run");
    }
  };

  // Helpers to edit list fields via textarea inputs
  const handleCriteriaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const lines = e.target.value.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
    onChange({ acceptance_criteria: lines });
  };
  const handleTagsChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const parts = e.target.value.split(",").map((s) => s.trim()).filter(Boolean);
    onChange({ tags: parts });
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-w-[100vw] mx-auto border-neutral-800 bg-neutral-950">
        <div className="max-w-[1040px] w-full mx-auto px-4 py-4">
          <DrawerHeader className="px-0">
            <DrawerTitle>Add feature (starts a new delta run)</DrawerTitle>
          </DrawerHeader>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
            <div className="space-y-2">
              <Label htmlFor="key">Key</Label>
              <Input
                id="key"
                placeholder="e.g., CARD-200"
                value={form.key ?? ""}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange({ key: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                placeholder="Short feature title"
                value={form.title ?? ""}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange({ title: e.target.value })}
              />
            </div>

            <div className="sm:col-span-2 space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="One-line description"
                rows={2}
                value={form.description ?? ""}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => onChange({ description: e.target.value })}
              />
            </div>

            <div className="sm:col-span-2 space-y-2">
              <Label htmlFor="ac">Acceptance criteria (one per line)</Label>
              <Textarea
                id="ac"
                placeholder="- User can do X\n- System returns Y"
                rows={5}
                value={(form.acceptance_criteria ?? []).join("\n")}
                onChange={handleCriteriaChange}
              />
            </div>

            <div className="sm:col-span-2 space-y-2">
              <Label htmlFor="tags">Tags (comma-separated)</Label>
              <Textarea
                id="tags"
                placeholder="domain:ledger, capability:transactions"
                rows={2}
                value={(form.tags ?? []).join(", ")}
                onChange={handleTagsChange}
              />
            </div>
          </div>

          {error ? <div className="mt-3 text-sm text-red-400">{error}</div> : null}

          <DrawerFooter className="px-0 mt-4">
            <div className="flex items-center gap-2">
              <Button
                onClick={handleSubmit}
                disabled={submitting || !workspaceId || !(form.key && form.title)}
              >
                {submitting ? "Starting run…" : "Start delta run"}
              </Button>
              <DrawerClose asChild>
                <Button variant="outline" disabled={submitting}>
                  Cancel
                </Button>
              </DrawerClose>
            </div>
          </DrawerFooter>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
