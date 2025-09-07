/* eslint-disable @typescript-eslint/no-explicit-any */
// webview-ui/raina-ui/src/components/overview/tabs/AddFeatureDrawer.tsx
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
import { useRainaStore } from "@/stores/useRainaStore";
import { callHost } from "@/lib/host";
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

// Prefer pack/model from provenance of baseline-generated artifacts
function inferPackAndModel(artifacts: any[]): {
  pack_key?: string;
  pack_version?: string;
  model?: string;
} {
  try {
    for (const a of artifacts ?? []) {
      const pk = a?.provenance?.pack_key as string | undefined;
      const pv = a?.provenance?.pack_version as string | undefined;
      const model = a?.provenance?.model_id as string | undefined;
      if (pk && pv) return { pack_key: pk, pack_version: pv, model };
    }
  } catch { /* ignore */ }
  return {};
}

// Minimal sanity check for baseline inputs we need
function hasUsableBaseline(b: any): boolean {
  if (!b || typeof b !== "object") return false;
  if (!b.pss || typeof b.pss !== "object") return false;
  // We require at least paradigm for backend validation
  return typeof b.pss.paradigm === "string" && b.pss.paradigm.length > 0;
}

export default function AddFeatureDrawer({ open, onOpenChange, defaultStory, onRunStarted }: Props) {
  const { currentWorkspaceId, wsDoc, artifacts, startRun } = useRainaStore();

  // Initialize & reset with defaults each time the drawer opens
  const [form, setForm] = React.useState<StoryItem>(defaultStory ?? DEFAULT_PREFILL);
  React.useEffect(() => {
    if (open) setForm(defaultStory ?? DEFAULT_PREFILL);
  }, [open, defaultStory]);

  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | undefined>();

  const onChange = (patch: Partial<StoryItem>) => setForm((f) => ({ ...f, ...patch }));

  // Robust workspace id (handles the short race after creating a workspace)
  const effectiveWorkspaceId =
    currentWorkspaceId ||
    (wsDoc as any)?.workspace_id ||
    (wsDoc as any)?.workspace?._id ||
    (wsDoc as any)?._id;

  // Pull fresh baseline if the store doesn’t have it yet
  async function getBaselineInputs(): Promise<{
    baseline: any;
    avc: any;
    pss: any;
    stories: StoryItem[];
  }> {
    let baseline = (wsDoc as any)?.inputs_baseline;
    if (!hasUsableBaseline(baseline)) {
      if (!effectiveWorkspaceId) {
        throw new Error("Workspace not loaded yet. Please wait a moment and try again.");
      }
      // Fetch the latest workspace doc and cache it into the store for consistency
      const fresh = await callHost<any>({ type: "workspace:get", payload: { id: effectiveWorkspaceId } });
      baseline = fresh?.inputs_baseline;
      // Update store so the rest of the UI gets the baseline too
      useRainaStore.setState({
        wsDoc: fresh,
        artifacts: Array.isArray(fresh?.artifacts) ? fresh.artifacts : artifacts,
      });
    }

    if (!hasUsableBaseline(baseline)) {
      throw new Error("Baseline inputs aren’t available yet. Run a baseline first (or wait for it to finish).");
    }

    const avc = baseline?.avc ?? {};
    const pss = baseline?.pss ?? {};
    const stories: StoryItem[] = Array.isArray(baseline?.fss?.stories) ? baseline.fss.stories : [];
    return { baseline, avc, pss, stories };
  }

  const handleSubmit = async () => {
    if (!effectiveWorkspaceId) {
      setError("Workspace not loaded yet. Please reopen the Overview tab in a second and try again.");
      return;
    }

    // Normalize form story
    const story: StoryItem = {
      key: (form.key ?? "").trim(),
      title: (form.title ?? "").trim(),
      description: (form.description ?? "").trim(),
      acceptance_criteria: (form.acceptance_criteria ?? []).map((x) => String(x).trim()).filter(Boolean),
      tags: (form.tags ?? []).map((x) => String(x).trim()).filter(Boolean),
    };

    if (!story.key || !story.title) {
      setError("Please provide both a Story Key and Title.");
      return;
    }

    setError(undefined);
    setSubmitting(true);

    try {
      // Ensure we have baseline inputs (fresh if needed)
      const { avc, pss, stories: baselineStories } = await getBaselineInputs();

      // Use the same pack/model as baseline artifacts (fallback to your defaults only if missing)
      const inferred = inferPackAndModel(artifacts ?? []);

      const requestBody = {
        playbook_id: "pb.micro.plus",
        workspace_id: effectiveWorkspaceId, // required by backend
        title: `Add ${story.key}`,
        description: story.title || "Delta feature",
        inputs: {
          avc,
          fss: { stories: [...baselineStories, story] },
          pss,
        },
        options: {
          validate: true,
          dry_run: false,
          ...(inferred.pack_key ? { pack_key: inferred.pack_key } : { pack_key: "svc-micro" }),
          ...(inferred.pack_version ? { pack_version: inferred.pack_version } : { pack_version: "v1.4" }),
          ...(inferred.model ? { model: inferred.model } : { model: "openai:gpt-4o-mini" }),
        },
      };

      // Start the run through the store (which routes to the host)
      await startRun(requestBody);

      // Persist the new story into the workspace baseline so it shows up immediately
      await callHost({
        type: "baseline:patch",
        payload: {
          workspaceId: effectiveWorkspaceId,
          fssStoriesUpsert: [story], // backend merges into inputs_baseline.fss.stories
        },
      });

      onRunStarted?.();
      onOpenChange(false);
    } catch (e: any) {
      setError(e?.message ?? "Failed to start delta run");
    } finally {
      setSubmitting(false);
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
                disabled={
                  submitting ||
                  !((form.key ?? "").trim() && (form.title ?? "").trim())
                }
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
