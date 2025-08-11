// src/components/workspace-detail/artifact/renderers/kinds/ContextMapRenderer.tsx
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

export default function ContextMapRenderer({
    data, editable, onChange,
}: { data: any; editable: boolean; onChange: (u: (d: any) => void) => void }) {
    const contexts = Array.isArray(data?.contexts) ? data.contexts : [];
    const rels = Array.isArray(data?.relationships) ? data.relationships : [];

    const updCtx = (i: number, patch: any) => onChange((d) => { d.contexts[i] = { ...d.contexts[i], ...patch }; });
    const addCtx = () => onChange((d) => (d.contexts ||= []).push({ name: "New Context", responsibilities: [], owned_entities: [] }));
    const delCtx = (i: number) => onChange((d) => d.contexts.splice(i, 1));

    const updRel = (i: number, patch: any) => onChange((d) => { d.relationships[i] = { ...d.relationships[i], ...patch }; });
    const addRel = () => onChange((d) => (d.relationships ||= []).push({ from: "", to: "", style: "upstream", notes: "" }));
    const delRel = (i: number) => onChange((d) => d.relationships.splice(i, 1));

    return (
        <div className="space-y-6">
            <section>
                <div className="text-sm font-medium mb-2">Bounded Contexts</div>
                <div className="grid md:grid-cols-2 gap-3">
                    {contexts.map((c: any, i: number) => (
                        <div key={i} className="rounded-xl border border-neutral-800 p-3 space-y-2">
                            {editable ? (
                                <>
                                    <Input value={c.name ?? ""} onChange={(e) => updCtx(i, { name: e.target.value })} />
                                    <Lined value={c.responsibilities ?? []} label="Responsibilities" onChange={(v) => updCtx(i, { responsibilities: v })} />
                                    <Lined value={c.owned_entities ?? []} label="Owned entities" onChange={(v) => updCtx(i, { owned_entities: v })} />
                                    <div className="text-right"><Button size="sm" variant="ghost" onClick={() => delCtx(i)}>Remove</Button></div>
                                </>
                            ) : (
                                <>
                                    <div className="font-medium">{c.name}</div>
                                    <KeyVals title="Responsibilities" values={c.responsibilities} />
                                    <KeyVals title="Owned entities" values={c.owned_entities} />
                                </>
                            )}
                        </div>
                    ))}
                </div>
                {editable && <Button size="sm" variant="secondary" className="mt-2" onClick={addCtx}>+ Add context</Button>}
            </section>

            <section>
                <div className="text-sm font-medium mb-2">Relationships</div>
                <div className="space-y-2">
                    {rels.map((r: any, i: number) => (
                        <div key={i} className="rounded-xl border border-neutral-800 p-3 grid gap-2 md:grid-cols-4">
                            {editable ? (
                                <>
                                    <Input placeholder="from" value={r.from ?? ""} onChange={(e) => updRel(i, { from: e.target.value })} />
                                    <Input placeholder="to" value={r.to ?? ""} onChange={(e) => updRel(i, { to: e.target.value })} />
                                    <Input placeholder="style" value={r.style ?? ""} onChange={(e) => updRel(i, { style: e.target.value })} />
                                    <Textarea placeholder="notes" className="md:col-span-4" value={r.notes ?? ""} onChange={(e) => updRel(i, { notes: e.target.value })} />
                                    <div className="md:col-span-4 text-right"><Button size="sm" variant="ghost" onClick={() => delRel(i)}>Remove</Button></div>
                                </>
                            ) : (
                                <>
                                    <div><span className="text-neutral-400">from</span> {r.from}</div>
                                    <div><span className="text-neutral-400">to</span> {r.to}</div>
                                    <div><span className="text-neutral-400">style</span> {r.style}</div>
                                    <div className="md:col-span-4 text-neutral-300">{r.notes}</div>
                                </>
                            )}
                        </div>
                    ))}
                </div>
                {editable && <Button size="sm" variant="secondary" className="mt-2" onClick={addRel}>+ Add relationship</Button>}
            </section>
        </div>
    );
}

function Lined({ value, label, onChange }: { value: string[]; label: string; onChange: (v: string[]) => void }) {
    return (
        <div>
            <div className="text-xs text-neutral-400 mb-1">{label}</div>
            <textarea
                className="w-full min-h-[72px] text-sm rounded-lg bg-neutral-950/60 border border-neutral-800 p-2"
                value={(value ?? []).join("\n")}
                onChange={(e) => onChange(e.target.value.split("\n").map((s) => s.trim()).filter(Boolean))}
            />
        </div>
    );
}

type KeyValsProps = { title: string; values?: string[] };

function KeyVals({ title, values }: KeyValsProps) {
    const list = values ?? [];
    if (!list.length) return null;
    return (
        <div>
            <div className="text-xs text-neutral-400 mb-1">{title}</div>
            <ul className="list-disc list-inside text-neutral-300">
                {list.map((v, i) => <li key={i}>{v}</li>)}
            </ul>
        </div>
    );
}
