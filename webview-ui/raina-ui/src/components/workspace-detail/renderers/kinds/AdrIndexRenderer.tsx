/* eslint-disable @typescript-eslint/no-explicit-any */
export default function AdrIndexRenderer({
  data,
}: { data: { adrs?: any[] } }) {
  const adrs = data?.adrs ?? [];
  return (
    <div className="rounded-xl border border-neutral-800 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-neutral-950 text-neutral-400">
          <tr>
            <th className="text-left p-2">ID</th>
            <th className="text-left p-2">Title</th>
            <th className="text-left p-2">Status</th>
            <th className="text-left p-2">Deciders</th>
            <th className="text-left p-2">Date</th>
          </tr>
        </thead>
        <tbody>
          {adrs.map((r, i) => (
            <tr key={i} className="border-t border-neutral-800">
              <td className="p-2">{r?.id ?? `ADR-${i+1}`}</td>
              <td className="p-2">{r?.title}</td>
              <td className="p-2">{r?.status}</td>
              <td className="p-2">{Array.isArray(r?.deciders) ? r.deciders.join(", ") : (r?.deciders ?? "—")}</td>
              <td className="p-2">{r?.date ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
