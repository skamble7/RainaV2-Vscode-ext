/* eslint-disable @typescript-eslint/no-explicit-any */
//webview-ui/raina-ui/src/components/workspace-detail/renderers/kinds/ServiceCatalogRenderer.tsx
import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type Service = {
  name: string;
  responsibilities?: string[];
  owner_team?: string;
  sla?: { availability?: string; latency_ms_p99?: number };
  primary_datastore?: { type?: string; name?: string };
  interfaces?: Array<{ style: string; name: string }>;
};

export default function ServiceCatalogRenderer({
  data, editable, onChange,
}: {
  data: { services: Service[] };
  editable: boolean;
  onChange: (updater: (d: any) => void) => void;
}) {
  const [local, setLocal] = useState<{ services: Service[] }>({ services: data?.services ?? [] });

  // keep local in sync when backing data changes or edit mode toggles
  useEffect(() => {
    setLocal({ services: data?.services ?? [] });
  }, [data, editable]);

  const sync = (next: { services: Service[] }) => {
    setLocal(next);
    if (editable) onChange((d) => { d.services = next.services; });
  };

  const updSvc = (i: number, patch: Partial<Service>) => {
    const next = structuredClone(local);
    next.services[i] = { ...next.services[i], ...patch };
    sync(next);
  };

  return (
    <div className="space-y-3">
      {local.services?.map((s, i) => (
        <div key={i} className="rounded-xl border border-neutral-800 p-3">
          <div className="flex items-center justify-between gap-3">
            {editable ? (
              <Input
                value={s.name ?? ""}
                onChange={(e) => updSvc(i, { name: e.target.value })}
              />
            ) : (
              <div className="font-medium">{s.name}</div>
            )}
            {editable && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  const next = structuredClone(local);
                  next.services.splice(i, 1);
                  sync(next);
                }}
              >
                Remove
              </Button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 mt-3">
            <Field label="Owner team">
              {editable
                ? <Input value={s.owner_team ?? ""} onChange={(e) => updSvc(i, { owner_team: e.target.value })} />
                : <span className="text-neutral-300">{s.owner_team ?? "—"}</span>}
            </Field>

            <Field label="Primary datastore">
              {editable ? (
                <div className="flex gap-2">
                  <Input
                    placeholder="type"
                    className="w-28"
                    value={s.primary_datastore?.type ?? ""}
                    onChange={(e) =>
                      updSvc(i, { primary_datastore: { ...(s.primary_datastore ?? {}), type: e.target.value } })
                    }
                  />
                  <Input
                    placeholder="name"
                    value={s.primary_datastore?.name ?? ""}
                    onChange={(e) =>
                      updSvc(i, { primary_datastore: { ...(s.primary_datastore ?? {}), name: e.target.value } })
                    }
                  />
                </div>
              ) : (
                <span className="text-neutral-300">
                  {s.primary_datastore?.type ?? "—"}{s.primary_datastore?.name ? ` • ${s.primary_datastore.name}` : ""}
                </span>
              )}
            </Field>

            <Field label="SLA availability">
              {editable
                ? <Input placeholder="e.g., 99.9%" value={s.sla?.availability ?? ""} onChange={(e) => updSvc(i, { sla: { ...(s.sla ?? {}), availability: e.target.value } })} />
                : <span className="text-neutral-300">{s.sla?.availability ?? "—"}</span>}
            </Field>

            <Field label="SLA p99 latency (ms)">
              {editable
                ? <Input type="number" value={s.sla?.latency_ms_p99 ?? "" as any}
                    onChange={(e) => updSvc(i, { sla: { ...(s.sla ?? {}), latency_ms_p99: Number(e.target.value) } })} />
                : <span className="text-neutral-300">{s.sla?.latency_ms_p99 ?? "—"}</span>}
            </Field>
          </div>

          <Field label="Responsibilities" className="mt-3">
            {editable ? (
              <Lines
                value={s.responsibilities ?? []}
                onChange={(arr) => updSvc(i, { responsibilities: arr })}
                placeholder="- line per responsibility"
              />
            ) : (
              <ul className="list-disc list-inside text-neutral-300">
                {(s.responsibilities ?? []).map((r, idx) => <li key={idx}>{r}</li>)}
              </ul>
            )}
          </Field>

          <Field label="Interfaces" className="mt-3">
            {editable ? (
              <Lines
                value={(s.interfaces ?? []).map((it) => `${it.style}:${it.name}`)}
                onChange={(arr) =>
                  updSvc(i, {
                    interfaces: arr
                      .filter(Boolean)
                      .map((t) => {
                        const [style, name] = String(t).split(":");
                        return { style: (style ?? "").trim(), name: (name ?? "").trim() };
                      }),
                  })
                }
                placeholder="rest:User API"
              />
            ) : (
              <div className="text-neutral-300">
                {(s.interfaces ?? []).map((it, j) => (
                  <span key={j} className="inline-block mr-2">{it.style}:{it.name}</span>
                ))}
              </div>
            )}
          </Field>
        </div>
      ))}

      {editable && (
        <div className="pt-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              const next = structuredClone(local);
              next.services.push({
                name: "New Service",
                responsibilities: [],
                interfaces: [],
                sla: {},
                primary_datastore: {},
              });
              sync(next);
            }}
          >
            + Add service
          </Button>
        </div>
      )}
    </div>
  );
}

function Field({ label, children, className = "" }: { label: string; children: any; className?: string }) {
  return (
    <div className={className}>
      <div className="text-xs text-neutral-400 mb-1">{label}</div>
      {children}
    </div>
  );
}

function Lines({
  value, onChange, placeholder,
}: { value: string[]; onChange: (arr: string[]) => void; placeholder?: string }) {
  return (
    <textarea
      className="w-full min-h-[80px] text-sm rounded-lg bg-neutral-950/60 border border-neutral-800 p-2"
      value={(value ?? []).join("\n")}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value.split("\n").map((s) => s.trim()).filter(Boolean))}
    />
  );
}
