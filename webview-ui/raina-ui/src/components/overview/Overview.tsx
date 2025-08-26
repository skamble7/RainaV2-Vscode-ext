/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from "react";
import { useRainaStore, type DiscoveryRun } from "@/stores/useRainaStore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import OverviewSummaryCard from "@/components/overview/OverviewSummaryCard";
import AvcTab from "@/components/overview/tabs/AvcTab";
import FssTab, { type StoryItem } from "@/components/overview/tabs/FssTab";
import PssTab from "@/components/overview/tabs/PssTab";

type Avc = any;
type Pss = any;

function firstCompleted(runs: DiscoveryRun[]): DiscoveryRun | undefined {
  const rs = runs.filter((r) => r.status === "completed");
  rs.sort((a, b) => (a.started_at ?? "").localeCompare(b.started_at ?? ""));
  return rs[0];
}
const isEmptyObj = (o: unknown) =>
  !!o && typeof o === "object" && !Array.isArray(o) && Object.keys(o as any).length === 0;

export default function Overview() {
  const { wsDoc, artifacts, runs, loadRuns, setTab } = useRainaStore();
  const [tab, setLocalTab] = useState<"avc" | "fss" | "pss">("fss");

  useEffect(() => {
    // loads runs for current workspace (store knows currentWorkspaceId)
    loadRuns();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Determine baseline AVC/PSS/FSS ----
  const { baselineAvc, baselinePss, baselineFss, baselineRun } = useMemo(() => {
    const bl = (wsDoc as any)?.inputs_baseline;
    if (bl && !isEmptyObj(bl)) {
      return {
        baselineAvc: bl.avc,
        baselinePss: bl.pss,
        baselineFss: (bl.fss?.stories as StoryItem[]) ?? [],
        baselineRun: undefined as DiscoveryRun | undefined,
      };
    }
    const candidate =
      runs.find((r: any) => r?.strategy === "baseline" && r.status === "completed") ||
      firstCompleted(runs);
    return {
      baselineAvc: (candidate as any)?.inputs?.avc,
      baselinePss: (candidate as any)?.inputs?.pss,
      baselineFss: ((candidate as any)?.inputs?.fss?.stories as StoryItem[]) ?? [],
      baselineRun: candidate,
    };
  }, [wsDoc, runs]);

  const artifactCount = (artifacts ?? []).length;
  const totalFeatures = (baselineFss ?? []).length;
  const openValidations =
    (((runs[0] as any)?.result_summary?.validations as any[]) ?? []).length;

  return (
    <div className="p-4 md:p-6 space-y-4">
      <OverviewSummaryCard
        paradigm={(baselinePss as any)?.paradigm}
        styles={((baselinePss as any)?.style ?? []) as string[]}
        tech={((baselinePss as any)?.tech_stack ?? []) as string[]}
        lastBaselineAt={(baselineRun as any)?.result_summary?.started_at}
        lastPromotedRunId={(wsDoc as any)?.last_promoted_run_id}
        featuresCount={totalFeatures}
        artifactsCount={artifactCount}
        validationsCount={openValidations}
      />

      <Card className="bg-neutral-900 border-neutral-800">
        <CardHeader className="pb-2">
          <CardTitle className="text-base text-neutral-200">Project Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={tab} onValueChange={(v) => setLocalTab(v as "avc" | "fss" | "pss")} className="w-full">
            <TabsList className="bg-neutral-800">
              <TabsTrigger value="avc">AVC</TabsTrigger>
              <TabsTrigger value="fss">FSS</TabsTrigger>
              <TabsTrigger value="pss">PSS</TabsTrigger>
            </TabsList>

            <TabsContent value="avc" className="pt-4">
              <AvcTab avc={baselineAvc} baselineRun={baselineRun} />
            </TabsContent>

            <TabsContent value="fss" className="pt-4">
              {/* baseline-only list + add feature → delta run */}
              <FssTab
                stories={(baselineFss ?? []) as StoryItem[]}
                onRunStarted={() => {
                  // ⛳️ switch the workspace tabs to "runs" in unified store
                  setTab("runs");
                }}
              />
            </TabsContent>

            <TabsContent value="pss" className="pt-4">
              <PssTab
                pss={baselinePss}
                onStartNewBaseline={() => {
                  const ev = new CustomEvent("raina:openDiscover", { detail: { mode: "baseline" } });
                  window.dispatchEvent(ev);
                }}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
