/* eslint-disable @typescript-eslint/no-explicit-any */
import * as React from "react";
import { z } from "zod";
import { useForm, useFieldArray, type Control, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
  DrawerClose,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { X, Plus } from "lucide-react";
import { vscode } from "@/lib/vscode";

/* ================= Types & Schema ================= */

type Props = {
  workspaceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const GoalSchema = z.object({
  id: z.string().min(1, "Goal id is required"),
  text: z.string().min(1, "Goal text is required"),
  metric: z.string().min(1, "Metric is required"),
});

const NonFunctionalSchema = z.object({
  type: z.string().min(1, "Type is required"),
  target: z.string().min(1, "Target is required"),
});

const SuccessCriterionSchema = z.object({
  kpi: z.string().min(1, "KPI is required"),
  target: z.string().min(1, "Target is required"),
});

const StorySchema = z.object({
  key: z.string().min(1, "Key is required"),
  title: z.string().min(1, "Title is required"),
  description: z.string().min(1, "Description is required"),
  acceptance_criteria: z.array(z.string().min(1)).min(1, "Add at least one acceptance criterion"),
  tags: z.array(z.string().min(1)).optional().default([]),
});

const Schema = z.object({
  playbook_id: z.string().min(1, "Playbook is required"),

  inputs: z.object({
    avc: z.object({
      vision: z.array(z.string().min(1)).min(1, "At least one vision point"),
      problem_statements: z.array(z.string().min(1)).min(1, "At least one problem statement"),
      goals: z.array(GoalSchema).min(1, "At least one goal"),
      non_functionals: z.array(NonFunctionalSchema).min(1, "At least one non-functional"),
      constraints: z.array(z.string().min(1)).min(1, "At least one constraint"),
      assumptions: z.array(z.string().min(1)).optional().default([]),
      context: z.object({
        domain: z.string().min(1, "Domain is required"),
        actors: z.array(z.string().min(1)).min(1, "At least one actor"),
      }),
      success_criteria: z.array(SuccessCriterionSchema).min(1, "At least one success criterion"),
    }),

    fss: z.object({
      stories: z.array(StorySchema).min(1, "At least one story"),
    }),

    pss: z.object({
      paradigm: z.string().min(1),
      style: z.array(z.string().min(1)).min(1, "Pick at least one style"),
      tech_stack: z.array(z.string().min(1)).min(1, "Pick at least one tech"),
    }),
  }),

  options: z.object({
    model: z.string().min(1),
    pack_key: z.string().min(1),
    pack_version: z.string().min(1),
    validate: z.boolean().default(true),
    dry_run: z.boolean().default(false),
  }),
});

type FormValues = z.infer<typeof Schema>;

/* ================= Defaults (matching your working sample) ================= */

const defaultValues: FormValues = {
  playbook_id: "pb.micro.plus",
  inputs: {
    avc: {
      vision: [
        "Modernize COBOL CardDemo into secure, scalable microservices",
        "Retain core capabilities for back-office operations and batch",
        "The application will enable back-office users to manage accounts, cards, transactions, and reporting, and administrators tomanage user access."
      ],
      problem_statements: [
        "Tightly coupled monolith impedes feature velocity",
      ],
      goals: [
        { id: "G1", text: "Microservices with clear bounded contexts", metric: "services decomposed by domain" },
        { id: "G2", text: "Security and auditability", metric: "auditable trails for all PII access" },
        { id: "G3", text: "Real-time balance updates + batch interest calc", metric: "eventual consistency < 2s" },
        { id: "G4", text: "Data lineage & reporting", metric: "lineage coverage 100%" },
      ],
      non_functionals: [
        { type: "performance", target: "p95<200ms" },
        { type: "reliability", target: "99.9% availability" },
        { type: "security", target: "PII encrypted at rest and in transit" },
      ],
      constraints: [
        "Retain batch processes; enhance where needed",
        "PII protection, masking, and access control",
        "Regulatory: PCI-lite, SOX-friendly audit logs",
        "cloud: aws",
      ],
      assumptions: ["Greenfield microservices can coexist with legacy batch for a period"],
      context: {
        domain: "Cards",
        actors: ["Customer", "BackOfficeUser", "BatchOrchestrator"],
      },
      success_criteria: [
        { kpi: "deployment_frequency", target: ">= daily" },
        { kpi: "lead_time_for_changes", target: "<= 1 day" },
      ],
    },

    fss: {
      stories: [
        {
          key: "CARD-101",
          title: "As a user, I can log in and navigate the portal",
          description: "Basic session management and navigation shell",
          acceptance_criteria: ["User can log in", "Session persists", "Logout works"],
          tags: ["domain:auth", "capability:portal"],
        },
        {
          key: "CARD-106",
          title: "As a user, I can list and view transactions",
          description: "Load transactions with pagination and filters",
          acceptance_criteria: ["List paginated", "View transaction details"],
          tags: ["domain:ledger", "capability:transactions"],
        },
        {
          key: "CARD-114",
          title: "As Ops, I can run daily/monthly batch jobs",
          description: "Trigger batch interest calc and reporting",
          acceptance_criteria: ["Daily job runs", "Monthly rollup generated"],
          tags: ["domain:batch", "capability:batch-orchestration"],
        },
      ],
    },

    pss: {
      paradigm: "Service-Based",
      style: ["Microservices", "Event-Driven", "Batch-Orchestration"],
      tech_stack: ["FastAPI", "MongoDB", "RabbitMQ", "LangGraph", "Python"],
    },
  },

  options: {
    model: "openai:gpt-4o-mini",
    pack_key: "svc-micro",
    pack_version: "v1.1",
    validate: true,
    dry_run: false,
  },
};

/* ================= Webview <-> Extension bridge ================= */

function sendVsRequest<T = any>(
  type: string,
  payload?: any,
  timeoutMs = 20000
): Promise<{ ok: boolean; data?: T; error?: string }> {
  return new Promise((resolve, reject) => {
    const token = crypto.randomUUID();

    const onMessage = (event: MessageEvent<any>) => {
      const msg = event.data;
      if (msg && msg.token === token) {
        window.removeEventListener("message", onMessage);
        resolve({ ok: !!msg.ok, data: msg.data, error: msg.error });
      }
    };

    window.addEventListener("message", onMessage);
    vscode.postMessage({ type, token, payload });

    const t = setTimeout(() => {
      window.removeEventListener("message", onMessage);
      reject(new Error("Timed out waiting for extension response"));
    }, timeoutMs);

    (resolve as any).finally?.(() => clearTimeout(t));
  });
}

/* ================= Component ================= */

export default function DiscoverArtifactsDrawer({
  workspaceId,
  open,
  onOpenChange,
}: Props) {
  const { toast } = useToast();

  const form = useForm<FormValues>({
    resolver: zodResolver(Schema) as unknown as Resolver<FormValues>,
    defaultValues,
    mode: "onSubmit",
  });

  // Field arrays for complex objects
  const goalsFA = useFieldArray({ control: form.control, name: "inputs.avc.goals", keyName: "key" });
  const nfrFA = useFieldArray({ control: form.control, name: "inputs.avc.non_functionals", keyName: "key" });
  const scFA = useFieldArray({ control: form.control, name: "inputs.avc.success_criteria", keyName: "key" });
  const storiesFA = useFieldArray({ control: form.control, name: "inputs.fss.stories", keyName: "key" });

  const [submitting, setSubmitting] = React.useState(false);

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true);
    try {
      // Construct the exact body the API expects (include workspace_id in body)
      const body = { ...values, workspace_id: workspaceId };

      if (vscode.available()) {
        const res = await sendVsRequest("discovery:start", {
          workspaceId,
          options: body, // extension backend sends to /discover/{workspace_id}
        });
        if (!res.ok) throw new Error(res.error || "Discovery start failed");
      } else {
        // Dev fallback (when running UI outside VS Code)
        const r = await fetch(`http://127.0.0.1:8013/discover/${workspaceId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!r.ok) throw new Error(await r.text());
      }

      toast({ title: "Discovery started", description: "Artifacts discovery request submitted successfully." });
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Failed to submit", description: err?.message ?? "Unknown error", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="right">
      <DrawerContent className="right-0 left-auto w-full sm:max-w-xl md:max-w-2xl">
        <DrawerHeader className="border-b">
          <DrawerTitle>Discover Artifacts</DrawerTitle>
          <DrawerDescription>Configure inputs and options, then submit to start discovery.</DrawerDescription>
        </DrawerHeader>

        {/* Scrollable body */}
        <ScrollArea className="h-[calc(100vh-9rem)]">
          <div className="p-4 md:p-6 space-y-8">
            <Form {...form}>
              <form id="discover-form" className="space-y-8" onSubmit={form.handleSubmit(onSubmit)}>
                {/* Playbook */}
                <section className="space-y-3">
                  <Label>Playbook</Label>
                  <FormField
                    control={form.control as Control<FormValues>}
                    name="playbook_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl><Input placeholder="pb.micro.plus" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </section>

                <Separator />

                {/* AVC */}
                <section className="space-y-4">
                  <h3 className="text-sm font-medium tracking-wide">AVC</h3>

                  <ArrayTextEditor
                    label="Vision"
                    values={form.watch("inputs.avc.vision")}
                    onChange={(arr) => form.setValue("inputs.avc.vision", arr, { shouldValidate: true })}
                  />

                  <ArrayTextEditor
                    label="Problem Statements"
                    values={form.watch("inputs.avc.problem_statements")}
                    onChange={(arr) => form.setValue("inputs.avc.problem_statements", arr, { shouldValidate: true })}
                  />

                  {/* Goals (object list) */}
                  <div className="space-y-2">
                    <Label>Goals</Label>
                    <div className="space-y-3">
                      {goalsFA.fields.map((f, idx) => (
                        <div key={f.key} className="rounded-2xl border p-3 md:p-4 space-y-3">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <FormField
                              control={form.control as Control<FormValues>}
                              name={`inputs.avc.goals.${idx}.id`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>ID</FormLabel>
                                  <FormControl><Input placeholder="G1" {...field} /></FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control as Control<FormValues>}
                              name={`inputs.avc.goals.${idx}.text`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Text</FormLabel>
                                  <FormControl><Input placeholder="Goal text" {...field} /></FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control as Control<FormValues>}
                              name={`inputs.avc.goals.${idx}.metric`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Metric</FormLabel>
                                  <FormControl><Input placeholder="Metric" {...field} /></FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                          <div className="flex justify-end">
                            <Button type="button" variant="ghost" size="sm" onClick={() => goalsFA.remove(idx)}>
                              <X className="h-4 w-4 mr-1" /> Remove
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <Button type="button" variant="outline" onClick={() => goalsFA.append({ id: "", text: "", metric: "" })}>
                      <Plus className="h-4 w-4 mr-2" /> Add Goal
                    </Button>
                  </div>

                  {/* Non-functionals */}
                  <div className="space-y-2">
                    <Label>Non-Functionals</Label>
                    <div className="space-y-3">
                      {nfrFA.fields.map((f, idx) => (
                        <div key={f.key} className="rounded-2xl border p-3 md:p-4 space-y-3">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <FormField
                              control={form.control as Control<FormValues>}
                              name={`inputs.avc.non_functionals.${idx}.type`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Type</FormLabel>
                                  <FormControl><Input placeholder="performance | reliability | security" {...field} /></FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control as Control<FormValues>}
                              name={`inputs.avc.non_functionals.${idx}.target`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Target</FormLabel>
                                  <FormControl><Input placeholder="p95<200ms" {...field} /></FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                          <div className="flex justify-end">
                            <Button type="button" variant="ghost" size="sm" onClick={() => nfrFA.remove(idx)}>
                              <X className="h-4 w-4 mr-1" /> Remove
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <Button type="button" variant="outline" onClick={() => nfrFA.append({ type: "", target: "" })}>
                      <Plus className="h-4 w-4 mr-2" /> Add Non-Functional
                    </Button>
                  </div>

                  <ArrayTextEditor
                    label="Constraints"
                    values={form.watch("inputs.avc.constraints")}
                    onChange={(arr) => form.setValue("inputs.avc.constraints", arr, { shouldValidate: true })}
                  />

                  <ArrayTextEditor
                    label="Assumptions"
                    values={form.watch("inputs.avc.assumptions")}
                    onChange={(arr) => form.setValue("inputs.avc.assumptions", arr, { shouldValidate: true })}
                  />

                  {/* Context */}
                  <div className="space-y-3">
                    <Label>Context</Label>
                    <FormField
                      control={form.control as Control<FormValues>}
                      name="inputs.avc.context.domain"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Domain</FormLabel>
                          <FormControl><Input placeholder="Cards" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <ArrayTextEditor
                      label="Actors"
                      values={form.watch("inputs.avc.context.actors")}
                      onChange={(arr) => form.setValue("inputs.avc.context.actors", arr, { shouldValidate: true })}
                    />
                  </div>

                  {/* Success criteria */}
                  <div className="space-y-2">
                    <Label>Success Criteria</Label>
                    <div className="space-y-3">
                      {scFA.fields.map((f, idx) => (
                        <div key={f.key} className="rounded-2xl border p-3 md:p-4 space-y-3">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <FormField
                              control={form.control as Control<FormValues>}
                              name={`inputs.avc.success_criteria.${idx}.kpi`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>KPI</FormLabel>
                                  <FormControl><Input placeholder="deployment_frequency" {...field} /></FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control as Control<FormValues>}
                              name={`inputs.avc.success_criteria.${idx}.target`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Target</FormLabel>
                                  <FormControl><Input placeholder=">= daily" {...field} /></FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                          <div className="flex justify-end">
                            <Button type="button" variant="ghost" size="sm" onClick={() => scFA.remove(idx)}>
                              <X className="h-4 w-4 mr-1" /> Remove
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <Button type="button" variant="outline" onClick={() => scFA.append({ kpi: "", target: "" })}>
                      <Plus className="h-4 w-4 mr-2" /> Add Success Criterion
                    </Button>
                  </div>
                </section>

                <Separator />

                {/* FSS — Stories */}
                <section className="space-y-4">
                  <h3 className="text-sm font-medium tracking-wide">FSS — Stories</h3>

                  <div className="space-y-3">
                    {storiesFA.fields.map((f, idx) => (
                      <div key={f.key} className="rounded-2xl border p-3 md:p-4 space-y-3">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <FormField
                            control={form.control as Control<FormValues>}
                            name={`inputs.fss.stories.${idx}.key`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Key</FormLabel>
                                <FormControl><Input placeholder="CARD-101" {...field} /></FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control as Control<FormValues>}
                            name={`inputs.fss.stories.${idx}.title`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Title</FormLabel>
                                <FormControl><Input placeholder="Story title" {...field} /></FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control as Control<FormValues>}
                            name={`inputs.fss.stories.${idx}.description`}
                            render={({ field }) => (
                              <FormItem className="md:col-span-3">
                                <FormLabel>Description</FormLabel>
                                <FormControl><Textarea rows={3} placeholder="Story description" {...field} /></FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <ArrayTextEditor
                          label="Acceptance Criteria"
                          values={form.watch(`inputs.fss.stories.${idx}.acceptance_criteria` as any) as string[]}
                          onChange={(arr) => form.setValue(`inputs.fss.stories.${idx}.acceptance_criteria` as any, arr, { shouldValidate: true })}
                        />

                        <TagEditor
                          label="Tags"
                          placeholder="Add a tag then press Enter"
                          values={form.watch(`inputs.fss.stories.${idx}.tags` as any) as string[]}
                          onChange={(arr) => form.setValue(`inputs.fss.stories.${idx}.tags` as any, arr, { shouldValidate: true })}
                        />

                        <div className="flex justify-end">
                          <Button type="button" variant="ghost" size="sm" onClick={() => storiesFA.remove(idx)}>
                            <X className="h-4 w-4 mr-1" /> Remove Story
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      storiesFA.append({
                        key: "",
                        title: "",
                        description: "",
                        acceptance_criteria: [],
                        tags: [],
                      })
                    }
                  >
                    <Plus className="h-4 w-4 mr-2" /> Add Story
                  </Button>
                </section>

                <Separator />

                {/* PSS */}
                <section className="space-y-4">
                  <h3 className="text-sm font-medium tracking-wide">PSS</h3>

                  <FormField
                    control={form.control as Control<FormValues>}
                    name="inputs.pss.paradigm"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Paradigm</FormLabel>
                        <FormControl>
                          <Select value={field.value} onValueChange={(v) => field.onChange(v)}>
                            <SelectTrigger><SelectValue placeholder="Select a paradigm" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Service-Based">Service-Based</SelectItem>
                              <SelectItem value="Microservices">Microservices</SelectItem>
                              <SelectItem value="Modular Monolith">Modular Monolith</SelectItem>
                              <SelectItem value="Event-Sourced">Event-Sourced</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <TagEditor
                    label="Style"
                    placeholder="Add a style then press Enter"
                    values={form.watch("inputs.pss.style")}
                    onChange={(arr) => form.setValue("inputs.pss.style", arr, { shouldValidate: true })}
                  />

                  <TagEditor
                    label="Tech Stack"
                    placeholder="Add a tech then press Enter"
                    values={form.watch("inputs.pss.tech_stack")}
                    onChange={(arr) => form.setValue("inputs.pss.tech_stack", arr, { shouldValidate: true })}
                  />
                </section>

                <Separator />

                {/* Options */}
                <section className="space-y-4">
                  <h3 className="text-sm font-medium tracking-wide">Options</h3>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField
                      control={form.control as Control<FormValues>}
                      name="options.model"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Model</FormLabel>
                          <FormControl><Input placeholder="openai:gpt-4o-mini" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control as Control<FormValues>}
                      name="options.pack_key"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Pack Key</FormLabel>
                          <FormControl><Input placeholder="svc-micro" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control as Control<FormValues>}
                      name="options.pack_version"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Pack Version</FormLabel>
                          <FormControl><Input placeholder="v1.1" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="flex items-center gap-6">
                    <FormField
                      control={form.control as Control<FormValues>}
                      name="options.validate"
                      render={({ field }) => (
                        <FormItem className="flex items-center gap-3">
                          <FormLabel className="m-0">Validate</FormLabel>
                          <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control as Control<FormValues>}
                      name="options.dry_run"
                      render={({ field }) => (
                        <FormItem className="flex items-center gap-3">
                          <FormLabel className="m-0">Dry Run</FormLabel>
                          <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                </section>
              </form>
            </Form>
          </div>
        </ScrollArea>

        {/* Sticky footer with actions */}
        <DrawerFooter className="border-t">
          <div className="flex items-center justify-end gap-2">
            <DrawerClose asChild><Button variant="ghost">Cancel</Button></DrawerClose>
            <Button type="submit" form="discover-form" disabled={submitting}>
              {submitting ? "Submitting…" : "Submit"}
            </Button>
          </div>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

/* ================= Small Reusable Editors ================= */

function ArrayTextEditor({
  label,
  values,
  onChange,
}: {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
}) {
  const add = () => onChange([...(values ?? []), ""]);
  const update = (i: number, v: string) => {
    const copy = [...values];
    copy[i] = v;
    onChange(copy);
  };
  const remove = (i: number) => {
    const copy = [...values];
    copy.splice(i, 1);
    onChange(copy);
  };
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="space-y-2">
        {(values ?? []).map((v, i) => (
          <div key={`${label}-${i}`} className="flex items-center gap-2">
            <Input value={v} onChange={(e) => update(i, e.target.value)} placeholder={`Enter ${label.toLowerCase().slice(0, -1)}`} />
            <Button type="button" variant="ghost" size="icon" onClick={() => remove(i)} title="Remove">
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
      <Button type="button" variant="outline" onClick={add}>
        <Plus className="h-4 w-4 mr-2" /> Add {label.slice(0, -1)}
      </Button>
    </div>
  );
}

function TagEditor({
  label,
  placeholder,
  values,
  onChange,
}: {
  label: string;
  placeholder?: string;
  values: string[];
  onChange: (values: string[]) => void;
}) {
  const [draft, setDraft] = React.useState("");

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && draft.trim()) {
      e.preventDefault();
      if (!values.includes(draft.trim())) onChange([...values, draft.trim()]);
      setDraft("");
    }
  };

  const remove = (val: string) => onChange(values.filter((v) => v !== val));

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex flex-wrap gap-2">
        {values.map((v) => (
          <span key={v} className="inline-flex items-center gap-1 rounded-2xl border px-3 py-1 text-sm">
            {v}
            <button type="button" onClick={() => remove(v)} className="opacity-70 hover:opacity-100" aria-label={`Remove ${v}`} title="Remove">
              <X className="h-3.5 w-3.5" />
            </button>
          </span>
        ))}
      </div>
      <Input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={onKeyDown} placeholder={placeholder} />
    </div>
  );
}
