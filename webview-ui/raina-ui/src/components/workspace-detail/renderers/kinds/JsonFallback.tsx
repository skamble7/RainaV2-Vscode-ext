// src/components/workspace-detail/artifact/renderers/kinds/JsonFallback.tsx
/* eslint-disable @typescript-eslint/no-explicit-any */
export default function JsonFallback({ data }: { data: any }) {
  return (
    <div>
      <div className="text-xs text-neutral-500 mb-2">No specialized view yet. Showing JSON.</div>
      <pre className="text-xs bg-neutral-950/60 rounded p-2 overflow-auto">
        {safe(data)}
      </pre>
    </div>
  );
}
function safe(v: unknown) { try { return JSON.stringify(v, null, 2); } catch { return String(v); } }
