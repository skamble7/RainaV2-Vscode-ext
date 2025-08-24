import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function OverviewSummaryCard(props: {
  paradigm?: string;
  styles: string[];
  tech: string[];
  lastBaselineAt?: string;
  lastPromotedRunId?: string | null;
  featuresCount: number;
  artifactsCount: number;
  validationsCount: number;
  loading?: boolean;
}) {
  const {
    paradigm, styles = [], tech = [], lastBaselineAt, lastPromotedRunId,
    featuresCount, artifactsCount, validationsCount, loading
  } = props;

  return (
    <Card className="bg-neutral-900 border-neutral-800">
      <CardContent className="p-4 md:p-5 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <div className="text-xs uppercase text-neutral-400 mb-1">Paradigm & Style</div>
          <div className="text-sm text-neutral-200">
            {paradigm ?? "—"}
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            {styles.map((s) => (
              <Badge key={s} variant="outline" className="border-neutral-700 text-neutral-300">{s}</Badge>
            ))}
          </div>
        </div>

        <div>
          <div className="text-xs uppercase text-neutral-400 mb-1">Tech</div>
          <div className="flex flex-wrap gap-1">
            {tech.map((t) => (
              <Badge key={t} variant="secondary" className="bg-neutral-800 text-neutral-200">{t}</Badge>
            ))}
          </div>
          <div className="text-xs text-neutral-500 mt-2">
            Baseline: {lastBaselineAt ? new Date(lastBaselineAt).toLocaleString() : "—"}
          </div>
          <div className="text-xs text-neutral-500">
            Last promoted run: {lastPromotedRunId ?? "—"}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center">
          <Metric label="Features" value={featuresCount} loading={loading} />
          <Metric label="Artifacts" value={artifactsCount} loading={loading} />
          <Metric label="Open Issues" value={validationsCount} loading={loading} />
        </div>
      </CardContent>
    </Card>
  );
}

function Metric({ label, value, loading }: { label: string; value: number; loading?: boolean }) {
  return (
    <div className="bg-neutral-800/60 rounded-xl p-3 border border-neutral-700">
      <div className="text-2xl font-semibold tabular-nums">{loading ? "…" : value}</div>
      <div className="text-xs text-neutral-400">{label}</div>
    </div>
  );
}
