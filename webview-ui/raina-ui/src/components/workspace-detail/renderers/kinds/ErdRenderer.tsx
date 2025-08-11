/* eslint-disable @typescript-eslint/no-explicit-any */
export default function ErdRenderer({
  data,
}: { data: { entities?: any[]; relations?: any[] } }) {
  const entities = data?.entities ?? [];
  const rels = data?.relations ?? [];
  return (
    <div className="space-y-4">
      <section className="space-y-2">
        <div className="text-sm font-medium">Entities</div>
        {entities.map((e, i) => (
          <div key={i} className="rounded-xl border border-neutral-800 p-3">
            <div className="font-medium">{e?.name}</div>
            <table className="w-full text-sm mt-2">
              <thead className="text-neutral-400">
                <tr><th className="text-left">Field</th><th className="text-left">Type</th><th>PK</th><th>FK</th></tr>
              </thead>
              <tbody>
                {(e?.fields ?? []).map((f: any, j: number) => (
                  <tr key={j} className="border-t border-neutral-800">
                    <td>{f?.name}</td>
                    <td>{f?.type}</td>
                    <td className="text-center">{f?.pk ? "✓" : "—"}</td>
                    <td className="text-center">{f?.fk ? "✓" : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </section>

      <section className="space-y-2">
        <div className="text-sm font-medium">Relations</div>
        {(rels ?? []).map((r, i) => (
          <div key={i} className="rounded-lg border border-neutral-800 p-2 text-sm">
            <span className="text-neutral-400">from</span> {r?.from}
            <span className="mx-2">→</span>
            <span className="text-neutral-400">to</span> {r?.to}
            {r?.type && <span className="ml-2 text-neutral-400">({r.type})</span>}
          </div>
        ))}
      </section>
    </div>
  );
}
