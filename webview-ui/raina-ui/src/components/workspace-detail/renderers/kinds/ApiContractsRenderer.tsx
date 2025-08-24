// src/components/workspace-detail/artifact/renderers/kinds/ApiContractsRenderer.tsx
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState, type ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

type ApiSvc = {
  name: string;
  style: "rest" | "grpc" | string;
  openapi?: string;   // inline or link
  grpc_idl?: string;  // inline .proto or link
};

export default function ApiContractsRenderer({
  data, editable, onChange,
}: {
  data: { doc_type?: "api_contracts"; services: ApiSvc[] };
  editable: boolean;
  onChange: (u: (d: any) => void) => void;
}) {
  const [local, setLocal] = useState<{ services: ApiSvc[] }>({ services: data?.services ?? [] });

  useEffect(() => {
    setLocal({ services: data?.services ?? [] });
  }, [data, editable]);

  const sync = (next: { services: ApiSvc[] }) => {
    setLocal(next);
    if (editable) onChange((d) => { d.services = next.services; d.doc_type = "api_contracts"; });
  };

  const upd = (i: number, patch: Partial<ApiSvc>) => {
    const next = structuredClone(local);
    next.services[i] = { ...next.services[i], ...patch };
    sync(next);
  };

  return (
    <div className="space-y-3">
      {(local.services ?? []).map((svc, i) => (
        <div key={i} className="rounded-xl border border-neutral-800 p-3 space-y-3">
          <div className="flex items-center justify-between gap-3">
            {editable ? (
              <Input value={svc.name ?? ""} onChange={(e) => upd(i, { name: e.target.value })} />
            ) : (
              <div className="font-medium">{svc.name}</div>
            )}
            {editable && (
              <Button size="sm" variant="ghost" onClick={() => {
                const next = structuredClone(local);
                next.services.splice(i, 1);
                sync(next);
              }}>Remove</Button>
            )}
          </div>

          <div className="grid md:grid-cols-3 gap-3">
            <Field label="Style">
              {editable
                ? <Input value={svc.style ?? ""} onChange={(e) => upd(i, { style: e.target.value })} />
                : <span className="text-neutral-300">{svc.style ?? "—"}</span>}
            </Field>
            <Field label="OpenAPI (URL or inline)">
              {editable
                ? <Input value={svc.openapi ?? ""} onChange={(e) => upd(i, { openapi: e.target.value })} />
                : <MonoOrDash value={svc.openapi} />}
            </Field>
            <Field label="gRPC IDL (.proto URL or inline)">
              {editable
                ? <Input value={svc.grpc_idl ?? ""} onChange={(e) => upd(i, { grpc_idl: e.target.value })} />
                : <MonoOrDash value={svc.grpc_idl} />}
            </Field>
          </div>

          {svc.openapi && looksLikeInline(svc.openapi) && (
            <Block label="OpenAPI (inline)">
              <Textarea rows={8} value={svc.openapi} onChange={(e) => editable && upd(i, { openapi: e.target.value })} disabled={!editable} />
            </Block>
          )}
          {svc.grpc_idl && looksLikeInline(svc.grpc_idl) && (
            <Block label="gRPC IDL (inline)">
              <Textarea rows={8} value={svc.grpc_idl} onChange={(e) => editable && upd(i, { grpc_idl: e.target.value })} disabled={!editable} />
            </Block>
          )}
        </div>
      ))}

      {editable && (
        <Button
          size="sm"
          variant="secondary"
          onClick={() => {
            const next = structuredClone(local);
            next.services.push({ name: "New Service", style: "rest", openapi: "", grpc_idl: "" });
            sync(next);
          }}
        >
          + Add API
        </Button>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="text-xs text-neutral-400 mb-1">{label}</div>
      {children}
    </div>
  );
}

function Block({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="text-xs text-neutral-400">{label}</div>
      {children}
    </div>
  );
}

function MonoOrDash({ value }: { value?: string }) {
  if (!value) return <span className="text-neutral-500">—</span>;
  const isUrl = /^https?:\/\//i.test(value);
  return isUrl ? (
    <a className="text-blue-400 underline underline-offset-2" href={value} target="_blank" rel="noreferrer">{value}</a>
  ) : (
    <code className="text-xs">{value.slice(0, 40)}{value.length > 40 ? "…" : ""}</code>
  );
}

function looksLikeInline(s: string) {
  if (!s) return false;
  if (/^https?:\/\//i.test(s)) return false;
  return /[\n\r{}]/.test(s); // crude but works
}
