/* eslint-disable @typescript-eslint/no-explicit-any */
export default function CapabilityModelRenderer({
  data,
}: { data: { capabilities?: any[] } }) {
  const caps = data?.capabilities ?? [];
  return (
    <div className="space-y-2">
      {caps.map((c, i) => <CapNode key={i} node={c} depth={0} />)}
    </div>
  );
}
function CapNode({ node, depth }: { node: any; depth: number }) {
  return (
    <div className="pl-2 border-l border-neutral-800 ml-[calc(var(--d,0)*8px)]" style={{ ["--d" as any]: depth }}>
      <div className="font-medium">{node?.name ?? "Untitled"}</div>
      {node?.description && <div className="text-sm text-neutral-400 mb-1">{node.description}</div>}
      {(node?.children ?? []).map((ch: any, i: number) => <CapNode key={i} node={ch} depth={depth + 1} />)}
    </div>
  );
}
