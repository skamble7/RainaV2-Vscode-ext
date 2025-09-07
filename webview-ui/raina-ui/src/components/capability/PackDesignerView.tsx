/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Plus, Trash2, ChevronUp, ChevronDown } from "lucide-react";

import CapabilityMultiSelect from "./CapabilityMultiSelect";
import PlaybookStepEditor from "./PlaybookStepEditor";
import { useCapabilityStore } from "@/stores/useCapabilityStore";
import { vscode } from "@/lib/vscode";

/**
 * PackDesignerView – full page wizard for capability packs.
 *
 * Wizard stages:
 *  1) Details
 *  2) Capabilities
 *  3) Playbooks/Steps
 *  4) Submit once at the end (createPack)
 */
type Props = {
  initialKey?: string;
  initialVersion?: string;
};

export default function PackDesignerView({ initialKey, initialVersion }: Props) {
  // Store
  const caps = useCapabilityStore((s) => s.caps);
  const loadCaps = useCapabilityStore((s) => s.loadCaps);
  const createPack = useCapabilityStore((s) => s.createPack);

  // Wizard state
  const [activeTab, setActiveTab] = useState<"details" | "capabilities" | "playbooks" | "test">("details");

  // Working model
  const [key, setKey] = useState(initialKey ?? "");
  const [version, setVersion] = useState(initialVersion ?? "v1.0");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const [capabilityIds, setCapabilityIds] = useState<string[]>([]);
  const [playbooks, setPlaybooks] = useState<any[]>([]);

  // Load registry capabilities
  useEffect(() => {
    loadCaps().catch(() => null);
  }, [loadCaps]);

  const validDetails = key.trim() && version.trim() && title.trim();
  const chosenCaps = useMemo(
    () => caps.filter((c) => capabilityIds.includes(c.id)),
    [caps, capabilityIds]
  );

  // Step handlers
  const handleNextFromDetails = () => {
    if (!validDetails) return;
    setActiveTab("capabilities");
  };

  const handleNextFromCaps = () => {
    if (!capabilityIds.length) return;
    setActiveTab("playbooks");
  };

  const addPlaybook = () => {
    const newPb = {
      id: `pb-${Date.now()}`,
      name: `Playbook ${playbooks.length + 1}`,
      description: "",
      steps: [] as any[],
    };
    setPlaybooks((prev) => [...prev, newPb]);
  };

  const removePlaybook = (pbId: string) => {
    setPlaybooks((prev) => prev.filter((p) => p.id !== pbId));
  };

  const updatePlaybookLocal = (pbId: string, patch: Partial<any>) => {
    setPlaybooks((prev) =>
      prev.map((p) => (p.id === pbId ? { ...p, ...patch } : p))
    );
  };

  const addStep = (pbId: string) => {
    const newStep = {
      id: `st-${Date.now()}`,
      name: "",
      description: "",
      capability_id: "",
      params: {},
    };
    setPlaybooks((prev) =>
      prev.map((p) => (p.id === pbId ? { ...p, steps: [...(p.steps ?? []), newStep] } : p))
    );
  };

  const updateStep = (pbId: string, stepId: string, next: any) => {
    setPlaybooks((prev) =>
      prev.map((p) =>
        p.id === pbId
          ? { ...p, steps: p.steps.map((s: any) => (s.id === stepId ? next : s)) }
          : p
      )
    );
  };

  const deleteStep = (pbId: string, stepId: string) => {
    setPlaybooks((prev) =>
      prev.map((p) =>
        p.id === pbId
          ? { ...p, steps: p.steps.filter((s: any) => s.id !== stepId) }
          : p
      )
    );
  };

  const moveStep = (pbId: string, index: number, dir: "up" | "down") => {
    const pb = playbooks.find((p) => p.id === pbId);
    if (!pb) return;
    const steps = [...(pb.steps ?? [])];
    const j = dir === "up" ? index - 1 : index + 1;
    if (j < 0 || j >= steps.length) return;
    [steps[index], steps[j]] = [steps[j], steps[index]];
    setPlaybooks((prev) =>
      prev.map((p) => (p.id === pbId ? { ...p, steps } : p))
    );
  };

  // Final submit
  const handleFinish = async () => {
    if (!validDetails) {
      alert("Please fill in key, version, and title.");
      setActiveTab("details");
      return;
    }
    if (!capabilityIds.length) {
      alert("Please select at least one capability.");
      setActiveTab("capabilities");
      return;
    }
    for (const pb of playbooks) {
      if (!pb.steps?.length) {
        alert(`Playbook "${pb.name || pb.id}" must include at least one step.`);
        return;
      }
      for (const st of pb.steps) {
        if (!st.capability_id) {
          alert(`Step missing capability in "${pb.name || pb.id}".`);
          return;
        }
      }
    }

    const payload = {
      key: key.trim(),
      version: version.trim(),
      title: title.trim(),
      description: description.trim() || undefined,
      capability_ids: capabilityIds.slice(),
      playbooks: playbooks.map((pb) => ({
        id: pb.id,
        name: pb.name?.trim() || undefined,
        description: pb.description?.trim() || undefined,
        steps: (pb.steps || []).map((st: any) => ({
          id: st.id,
          name: st.name?.trim() || undefined,
          description: st.description?.trim() || undefined,
          capability_id: st.capability_id,
          params: st.params ?? {},
        })),
      })),
    };

    try {
      await createPack(payload);
      vscode.postMessage({ type: "packDesigner:closeAndReturn" });
    } catch (e: any) {
      alert(`Failed to create pack: ${e?.message || e}`);
    }
  };

  return (
    <div className="h-full w-full p-6 flex flex-col">
      <h2 className="text-xl font-semibold mb-4">Capability Pack Designer</h2>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="flex-1 flex flex-col">
        <TabsList className="grid grid-cols-4 mb-4">
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="capabilities" disabled={!validDetails}>Capabilities</TabsTrigger>
          <TabsTrigger value="playbooks" disabled={!capabilityIds.length}>Playbook</TabsTrigger>
          <TabsTrigger value="test" disabled>Test Run</TabsTrigger>
        </TabsList>

        {/* STEP 1: DETAILS */}
        <TabsContent value="details" className="flex-1 overflow-hidden">
          <div className="h-full flex flex-col">
            <div className="grid grid-cols-2 gap-3">
              <Input
                placeholder="Key (e.g. svc-micro)"
                value={key}
                onChange={(e) => setKey(e.target.value)}
              />
              <Input
                placeholder="Version (e.g. v1.4)"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
              />
            </div>
            <div className="mt-3">
              <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="mt-3">
              <Textarea
                placeholder="Description (optional)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>

            <div className="mt-auto pt-4 flex justify-end gap-2">
              <Button onClick={handleNextFromDetails} disabled={!validDetails}>
                Next: Capabilities
              </Button>
            </div>
          </div>
        </TabsContent>

        {/* STEP 2: CAPABILITIES */}
        <TabsContent value="capabilities" className="flex-1 overflow-hidden">
          <div className="h-full flex flex-col">
            <CapabilityMultiSelect
              capabilities={caps}
              selected={capabilityIds}
              onChange={setCapabilityIds}
            />
            <div className="mt-auto pt-4 flex justify-between">
              <Button variant="outline" onClick={() => setActiveTab("details")}>
                Back
              </Button>
              <Button onClick={handleNextFromCaps} disabled={!capabilityIds.length}>
                Save & Next
              </Button>
            </div>
          </div>
        </TabsContent>

        {/* STEP 3: PLAYBOOKS */}
        <TabsContent value="playbooks" className="flex-1 overflow-hidden">
          <div className="h-full flex flex-col">
            <div className="flex items-center justify-between">
              <div className="text-sm text-neutral-400">
                Using {chosenCaps.length} capabilities
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={addPlaybook}>
                  <Plus className="h-4 w-4 mr-1" /> Add Playbook
                </Button>
              </div>
            </div>

            <Separator className="my-3 opacity-30" />

            <div className="flex-1 overflow-auto space-y-4 pr-1">
              {playbooks.map((pb, i) => (
                <div key={pb.id} className="border border-neutral-700 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Input
                      className="font-medium"
                      value={pb.name ?? ""}
                      onChange={(e) => updatePlaybookLocal(pb.id, { name: e.target.value })}
                      placeholder={`Playbook ${i + 1}`}
                    />
                    <Button size="icon" variant="destructive" onClick={() => removePlaybook(pb.id)} title="Delete playbook">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <Textarea
                    className="mb-3"
                    value={pb.description ?? ""}
                    onChange={(e) => updatePlaybookLocal(pb.id, { description: e.target.value })}
                    placeholder="Playbook description"
                    rows={2}
                  />

                  <div className="space-y-3">
                    {(pb.steps ?? []).map((st: any, idx: number) => (
                      <div key={st.id} className="relative">
                        <PlaybookStepEditor
                          step={st}
                          capabilities={chosenCaps.map((c) => ({ id: c.id, name: c.name }))}
                          onChange={(next) => updateStep(pb.id, st.id, next)}
                          onDelete={() => deleteStep(pb.id, st.id)}
                        />
                        <div className="absolute right-2 -top-3 flex gap-1">
                          <Button size="icon" variant="secondary" onClick={() => moveStep(pb.id, idx, "up")} title="Move up">
                            <ChevronUp className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="secondary" onClick={() => moveStep(pb.id, idx, "down")} title="Move down">
                            <ChevronDown className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}

                    <Button size="sm" variant="outline" onClick={() => addStep(pb.id)}>
                      <Plus className="h-4 w-4 mr-1" /> Add Step
                    </Button>
                  </div>
                </div>
              ))}
              {!playbooks.length && (
                <div className="text-sm text-neutral-400">No playbooks yet. Click “Add Playbook”.</div>
              )}
            </div>

            <div className="pt-3 flex justify-between">
              <Button variant="outline" onClick={() => setActiveTab("capabilities")}>Back</Button>
              <Button onClick={handleFinish}>Finish & Create Pack</Button>
            </div>
          </div>
        </TabsContent>

        {/* STEP 4: TEST (placeholder) */}
        <TabsContent value="test" className="flex-1 flex items-center justify-center">
          <div className="text-neutral-400 text-center">
            <p className="mb-1">Test run feature is not ready yet.</p>
            <p className="text-xs opacity-80">We‘ll enable this once the backend endpoint is available.</p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
