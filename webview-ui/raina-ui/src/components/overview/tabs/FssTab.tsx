/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo, useState } from "react";
import { useWorkspaceDetailStore } from "@/stores/useWorkspaceDetailStore";
import { useRunsStore } from "@/stores/useRunsStore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

export type StoryItem = {
  key: string;
  title?: string;
  description?: string;
  acceptance_criteria?: string[];
  tags?: string[];
};

type Props = {
  stories: StoryItem[];
};

/** Renders the *current* (baseline) FSS and allows adding a new FSS story (delta run). */
export default function FssTab({ stories }: Props) {
  const { detail } = useWorkspaceDetailStore();
  const workspaceId =
    (detail as any)?.workspace_id ?? (detail as any)?.workspace?._id ?? "";

  const { start } = useRunsStore();
  const { toast } = useToast();

  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);

  // New story draft
  const [key, setKey] = useState("");
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [acText, setAcText] = useState("");
  const [tagsText, setTagsText] = useState("");

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return stories;
    return stories.filter((s) => {
      const hay = `${s.key} ${s.title ?? ""} ${s.description ?? ""} ${(s.tags ?? []).join(" ")}`.toLowerCase();
      return hay.includes(q);
    });
  }, [stories, query]);

  return (
    <div className="space-y-3">
      {/* Controls */}
      <div className="flex items-center gap-3">
        <Input
          placeholder="Search features…"
          className="w-72"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="flex-1" />
        <Button onClick={() => setAdding(true)}>Add feature</Button>
      </div>

      {/* List */}
      <div className="space-y-3">
        {list.length === 0 ? (
          <div className="text-sm text-neutral-400">No features found in the current baseline.</div>
        ) : (
          list.map((s) => (
            <Card key={s.key} className="bg-neutral-900 border-neutral-800">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-xs text-neutral-400">{s.key}</div>
                    <CardTitle className="text-base">{s.title}</CardTitle>
                    {s.description && (
                      <div className="text-xs text-neutral-400 mt-1">{s.description}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {(s.tags ?? []).map((t) => (
                      <Badge key={t} variant="outline" className="bg-neutral-800 border-neutral-700">
                        {t}
                      </Badge>
                    ))}
                  </div>
                </div>
              </CardHeader>
              {Array.isArray(s.acceptance_criteria) && s.acceptance_criteria.length > 0 && (
                <CardContent className="pt-0">
                  <ul className="list-disc list-inside text-sm text-neutral-300 space-y-1">
                    {s.acceptance_criteria.map((a, i) => (
                      <li key={i}>{a}</li>
                    ))}
                  </ul>
                </CardContent>
              )}
            </Card>
          ))
        )}
      </div>

      {/* Add Feature Drawer-ish inline panel */}
      {adding && (
        <Card className="bg-neutral-900 border-neutral-800">
          <CardHeader>
            <CardTitle className="text-base">Add feature (starts a new delta run)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-neutral-400">Key</label>
                <Input value={key} onChange={(e) => setKey(e.target.value)} placeholder="e.g., CARD-200" />
              </div>
              <div>
                <label className="text-xs text-neutral-400">Title</label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Short feature title" />
              </div>
            </div>
            <div>
              <label className="text-xs text-neutral-400">Description</label>
              <Textarea
                rows={2}
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                placeholder="One‑line description"
              />
            </div>
            <div>
              <label className="text-xs text-neutral-400">Acceptance criteria (one per line)</label>
              <Textarea
                rows={3}
                value={acText}
                onChange={(e) => setAcText(e.target.value)}
                placeholder="- User can do X\n- System returns Y"
              />
            </div>
            <div>
              <label className="text-xs text-neutral-400">Tags (comma‑separated)</label>
              <Input
                value={tagsText}
                onChange={(e) => setTagsText(e.target.value)}
                placeholder="domain:ledger, capability:transactions"
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <Button
                onClick={async () => {
                  if (!workspaceId) {
                    toast({ title: "No workspace id", description: "Cannot start run without a workspace.", variant: "destructive" });
                    return;
                  }
                  const story = {
                    key: key.trim(),
                    title: title.trim(),
                    description: desc.trim(),
                    acceptance_criteria: acText
                      .split("\n")
                      .map((ln) => ln.replace(/^\s*[-*]\s*/, "").trim())
                      .filter(Boolean),
                    tags: tagsText
                      .split(",")
                      .map((t) => t.trim())
                      .filter(Boolean),
                  };

                  try {
                    await start(workspaceId, {
                      title: `Add feature ${story.key}`,
                      description: story.title,
                      playbook_id: "pb.micro.plus",
                      strategy: "delta",
                      inputs: { fss: { stories: [story] } },
                      options: { validate: true, dry_run: false, pack_key: "svc-micro", pack_version: "v1.2" },
                    });
                    toast({ title: "Run started", description: `Delta run queued for ${story.key}` });
                    setAdding(false);
                    // reset fields
                    setKey(""); setTitle(""); setDesc(""); setAcText(""); setTagsText("");
                  } catch (e: any) {
                    toast({ title: "Failed to start run", description: e?.message ?? String(e), variant: "destructive" });
                  }
                }}
              >
                Start run
              </Button>
              <Button variant="ghost" onClick={() => setAdding(false)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
