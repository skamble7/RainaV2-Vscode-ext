// src/components/workspace-detail/artifact/renderers/kinds/ServiceContractRenderer.tsx
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function ServiceContractRenderer({
  data, editable, onChange,
}: { data: any; editable: boolean; onChange: (u: (d: any) => void) => void }) {
  const endpoints = Array.isArray(data?.endpoints) ? data.endpoints : [];

  const setService = (v: string) => onChange((d) => { d.service = v; });
  const upd = (i: number, patch: any) => onChange((d) => { d.endpoints[i] = { ...d.endpoints[i], ...patch }; });
  const add = () => onChange((d) => (d.endpoints ||= []).push({ method: "GET", path: "/", in: {}, out: {} }));
  const del = (i: number) => onChange((d) => d.endpoints.splice(i, 1));

  return (
    <div className="space-y-3">
      <div>
        <div className="text-xs text-neutral-400 mb-1">Service name</div>
        {editable
          ? <Input value={data?.service ?? ""} onChange={(e) => setService(e.target.value)} />
          : <div className="text-lg font-medium">{data?.service ?? "Unnamed Service"}</div>}
      </div>

      <div className="text-xs text-neutral-400">Endpoints</div>
      {endpoints.map((ep: any, i: number) => (
        <div key={i} className="rounded-xl border border-neutral-800 p-3 grid gap-2 md:grid-cols-5">
          {editable ? (
            <>
              <Input placeholder="method" value={ep.method ?? ""} onChange={(e) => upd(i, { method: e.target.value })} />
              <Input placeholder="path" className="md:col-span-2" value={ep.path ?? ""} onChange={(e) => upd(i, { path: e.target.value })} />
              <Input placeholder="in (brief)" className="md:col-span-1" value={brief(ep.in)} onChange={(e) => upd(i, { in: { brief: e.target.value } })} />
              <Input placeholder="out (brief)" className="md:col-span-1" value={brief(ep.out)} onChange={(e) => upd(i, { out: { brief: e.target.value } })} />
              <div className="md:col-span-5 text-right"><Button size="sm" variant="ghost" onClick={() => del(i)}>Remove</Button></div>
            </>
          ) : (
            <>
              <div>{ep.method}</div>
              <div className="md:col-span-2">{ep.path}</div>
              <div>{brief(ep.in)}</div>
              <div>{brief(ep.out)}</div>
            </>
          )}
        </div>
      ))}
      {editable && <Button size="sm" variant="secondary" onClick={add}>+ Add endpoint</Button>}
    </div>
  );
}

function brief(x: any) {
  if (!x) return "—";
  if (typeof x.brief === "string") return x.brief;
  return "…";
}
