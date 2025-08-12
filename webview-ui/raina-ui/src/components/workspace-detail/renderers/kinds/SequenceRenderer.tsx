// src/components/workspace-detail/artifact/renderers/kinds/SequenceRenderer.tsx
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { vscode } from "@/lib/vscode";

export default function SequenceRenderer({ data, editable, onChange }: any) {
  const setNotation = (v: string) => onChange((d: any) => { d.notation = v; });
  const setDrawioXml = (v: string) => onChange((d: any) => { d.drawio_xml = v; });

  const drawioXml: string = data?.drawio_xml ?? "";   // <- exact key from your screenshot
  const title = data?.name || data?.title || "Sequence Diagram";

  const openInDrawio = () => {
    vscode?.postMessage({
      type: "raina.openDrawio",
      payload: { title, xml: drawioXml },
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="grid grid-cols-2 gap-2 w-full">
          <div>
            <div className="text-xs text-neutral-400 mb-1">Notation</div>
            {editable ? (
              <Input value={data?.notation ?? "drawio"} onChange={(e) => setNotation(e.target.value)} />
            ) : (
              <div className="text-neutral-300">{data?.notation ?? "drawio"}</div>
            )}
          </div>
        </div>

        <div className="ml-3 shrink-0">
          <Button size="sm" variant="secondary" onClick={openInDrawio}>
            Open in Draw.io
          </Button>
        </div>
      </div>

      <div>
        <div className="text-xs text-neutral-400 mb-1">Draw.io XML</div>
        {editable ? (
          <Textarea rows={12} value={drawioXml} onChange={(e) => setDrawioXml(e.target.value)} />
        ) : (
          <pre className="text-xs bg-neutral-950/60 rounded p-2 overflow-auto">{drawioXml}</pre>
        )}
      </div>
    </div>
  );
}
