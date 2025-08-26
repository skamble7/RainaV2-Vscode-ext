/* eslint-disable @typescript-eslint/no-explicit-any */
// webview-ui/raina-ui/src/components/overview/tabs/PssTab.tsx
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function PssTab({ pss, onStartNewBaseline }: { pss: any; onStartNewBaseline: () => void }) {
  if (!pss) {
    return (
      <Card className="bg-neutral-900 border-neutral-800">
        <CardContent className="p-4">
          <div className="text-sm text-neutral-500">No baseline PSS yet. Start a baseline to define paradigm/style.</div>
          <button onClick={onStartNewBaseline}
            className="mt-3 text-xs px-3 py-2 rounded-md bg-neutral-200 text-neutral-900">
            Start new baseline
          </button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card className="bg-neutral-900 border-neutral-800">
        <CardHeader><CardTitle className="text-sm">Paradigm</CardTitle></CardHeader>
        <CardContent className="text-neutral-200">{pss.paradigm ?? "—"}</CardContent>
      </Card>

      <Card className="bg-neutral-900 border-neutral-800">
        <CardHeader><CardTitle className="text-sm">Styles</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-1">
          {(pss.style ?? []).map((s: string) => (
            <Badge key={s} variant="outline" className="border-neutral-700 text-neutral-300">{s}</Badge>
          ))}
        </CardContent>
      </Card>

      <Card className="bg-neutral-900 border-neutral-800">
        <CardHeader><CardTitle className="text-sm">Tech stack</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-1">
          {(pss.tech_stack ?? []).map((t: string) => (
            <Badge key={t} variant="secondary" className="bg-neutral-800 text-neutral-200">{t}</Badge>
          ))}
        </CardContent>
      </Card>

      <Card className="bg-neutral-900 border-neutral-800">
        <CardHeader><CardTitle className="text-sm">Change control</CardTitle></CardHeader>
        <CardContent className="text-xs text-neutral-500">
          To change baseline PSS, start a new baseline run.  
          <button onClick={onStartNewBaseline}
            className="ml-2 text-xs px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 border border-neutral-700">
            Start new baseline
          </button>
        </CardContent>
      </Card>
    </div>
  );
}
