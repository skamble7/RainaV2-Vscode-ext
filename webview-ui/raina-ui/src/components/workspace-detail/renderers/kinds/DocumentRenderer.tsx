// src/components/workspace-detail/artifact/renderers/kinds/DocumentRenderer.tsx
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

export default function DocumentRenderer({
  data, editable, onChange,
}: { data: any; editable: boolean; onChange: (u: (d: any) => void) => void }) {
  const sections = Array.isArray(data?.sections) ? data.sections : [];

  const setTitle = (v: string) => onChange((d) => { d.title = v; });
  const setSec = (i: number, patch: { title?: string; body?: string }) =>
    onChange((d) => { d.sections[i] = { ...d.sections[i], ...patch }; });
  const addSec = () => onChange((d) => { (d.sections ||= []).push({ title: "New Section", body: "" }); });
  const delSec = (i: number) => onChange((d) => { d.sections.splice(i, 1); });

  return (
    <div className="space-y-4">
      <div>
        <div className="text-xs text-neutral-400 mb-1">Title</div>
        {editable
          ? <Input value={data?.title ?? ""} onChange={(e) => setTitle(e.target.value)} />
          : <div className="text-lg font-medium">{data?.title ?? "Untitled"}</div>}
      </div>

      <div className="space-y-3">
        <div className="text-xs text-neutral-400">Sections</div>
        {sections.map((s: any, i: number) => (
          <div key={i} className="rounded-xl border border-neutral-800 p-3 space-y-2">
            {editable ? (
              <>
                <Input value={s.title ?? ""} onChange={(e) => setSec(i, { title: e.target.value })} />
                <Textarea rows={6} value={s.body ?? ""} onChange={(e) => setSec(i, { body: e.target.value })} />
                <div className="text-right">
                  <Button size="sm" variant="ghost" onClick={() => delSec(i)}>Remove</Button>
                </div>
              </>
            ) : (
              <>
                <div className="font-medium">{s.title}</div>
                <div className="whitespace-pre-wrap text-neutral-300">{s.body}</div>
              </>
            )}
          </div>
        ))}
        {editable && <Button size="sm" variant="secondary" onClick={addSec}>+ Add section</Button>}
      </div>
    </div>
  );
}
