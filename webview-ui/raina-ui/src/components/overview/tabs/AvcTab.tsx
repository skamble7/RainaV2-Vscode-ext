/* eslint-disable @typescript-eslint/no-explicit-any */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { DiscoveryRun } from "@/stores/useRainaStore";

export default function AvcTab({ avc, baselineRun }: { avc: any; baselineRun?: DiscoveryRun }) {
  if (!avc) {
    return <Empty msg="No baseline AVC yet. Start a baseline discovery to populate this section." />;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card className="bg-neutral-900 border-neutral-800">
        <CardHeader><CardTitle className="text-sm">Vision</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {avc.vision?.map((v: string, i: number) => <li key={i} className="list-disc ml-4 text-neutral-200">{v}</li>)}
        </CardContent>
      </Card>

      <Card className="bg-neutral-900 border-neutral-800">
        <CardHeader><CardTitle className="text-sm">Goals</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {(avc.goals ?? []).map((g: any) => (
            <div key={g.id} className="border border-neutral-800 rounded-lg p-2">
              <div className="text-neutral-200">{g.text}</div>
              {g.metric && <div className="text-xs text-neutral-500 mt-1">{g.metric}</div>}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="bg-neutral-900 border-neutral-800">
        <CardHeader><CardTitle className="text-sm">Problem Statements</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {(avc.problem_statements ?? []).map((p: string, i: number) =>
            <li key={i} className="list-disc ml-4 text-neutral-300">{p}</li>
          )}
        </CardContent>
      </Card>

      <Card className="bg-neutral-900 border-neutral-800">
        <CardHeader><CardTitle className="text-sm">Non-functionals</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-1">
          {(avc.non_functionals ?? []).map((n: any, i: number) => (
            <Badge key={i} variant="outline" className="border-neutral-700 text-neutral-300">
              {n.type}: {n.target}
            </Badge>
          ))}
        </CardContent>
      </Card>

      <Card className="bg-neutral-900 border-neutral-800">
        <CardHeader><CardTitle className="text-sm">Context</CardTitle></CardHeader>
        <CardContent>
          <div className="text-sm text-neutral-300">Domain: {avc?.context?.domain ?? "—"}</div>
          <div className="mt-2 text-xs text-neutral-500">Actors</div>
          <div className="flex flex-wrap gap-1 mt-1">
            {(avc?.context?.actors ?? []).map((a: string) => (
              <Badge key={a} variant="secondary" className="bg-neutral-800 text-neutral-200">{a}</Badge>
            ))}
          </div>
          {baselineRun && (
            <div className="text-xs text-neutral-500 mt-3">
              From baseline run {baselineRun.run_id}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Empty({ msg }: { msg: string }) {
  return <div className="text-sm text-neutral-500">{msg}</div>;
}
