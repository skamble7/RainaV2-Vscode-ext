// src/components/workspace-detail/artifact/renderers/kinds/SequenceRenderer.tsx
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export default function SequenceRenderer({
  data, editable, onChange,
}: { data: any; editable: boolean; onChange: (u: (d: any) => void) => void }) {
  const setNotation = (v: string) => onChange((d) => { d.notation = v; });
  const setSource = (v: string) => onChange((d) => { d.source = v; });

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <div className="text-xs text-neutral-400 mb-1">Notation</div>
          {editable
            ? <Input value={data?.notation ?? "mermaid"} onChange={(e) => setNotation(e.target.value)} />
            : <div className="text-neutral-300">{data?.notation ?? "mermaid"}</div>}
        </div>
      </div>

      <div>
        <div className="text-xs text-neutral-400 mb-1">Source</div>
        {editable
          ? <Textarea rows={12} value={data?.source ?? ""} onChange={(e) => setSource(e.target.value)} />
          : <pre className="text-xs bg-neutral-950/60 rounded p-2 overflow-auto">{data?.source ?? ""}</pre>}
      </div>

      {/* Optional: add Mermaid rendering once you add the dependency */}
      {/* if (data?.notation === 'mermaid') <Mermaid code={data.source}/> */}
    </div>
  );
}
