// webview-ui/raina-ui/src/components/workspace-detail/artifact/ArtifactView.tsx
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useMemo, useState } from "react";
import { useRainaStore } from "@/stores/useRainaStore";
import { Button } from "@/components/ui/button";

/**
 * ArtifactView (no History tab)
 * - Single component that renders ANY artifact based on its JSON Schema.
 * - Fetches the kind schema from registry: /registry/kinds/<key>
 * - Renders:
 *    • Arrays of uniform objects => responsive table
 *    • Objects => key/value cards (nested arrays handled recursively)
 *    • Fallback => JSON pretty print
 */

export default function ArtifactView() {
  const { artifacts, selectedArtifactId, getKindSchema, refreshArtifact, wsDoc } = useRainaStore();

  const artifact = useMemo(
    () => artifacts.find((a) => a.artifact_id === selectedArtifactId),
    [artifacts, selectedArtifactId]
  );

  const [schema, setSchema] = useState<any | null>(null);

  // Load JSON Schema for selected artifact's kind
  useEffect(() => {
    let cancelled = false;
    async function run() {
      setSchema(null);
      if (!artifact?.kind) return;
      const reg = await getKindSchema(artifact.kind);
      if (cancelled) return;
      const latest =
        reg?.schema_versions?.find((v) => v.version === reg.latest_schema_version) ??
        reg?.schema_versions?.[0];
      setSchema(latest?.json_schema ?? null);
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [artifact?.kind, getKindSchema]);

  if (!artifact) {
    return <div className="p-4 text-sm text-neutral-400">Select an artifact to view.</div>;
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-2 border-b border-neutral-800 flex items-center justify-between">
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-wide text-neutral-400 truncate">
            {artifact.kind}
          </div>
        {/* name */}
          <div className="font-medium truncate">{artifact.name}</div>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => refreshArtifact(artifact.artifact_id)}>
            Refresh
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4">
        <SchemaDrivenRenderer data={artifact.data} schema={schema} />
      </div>

      <div className="px-4 py-2 border-t border-neutral-800 text-xs text-neutral-500">
        Workspace: {wsDoc?.workspace?.name ?? "—"} • Version: {String(artifact.version ?? "1")}
      </div>
    </div>
  );
}

/* =========================
 * Schema-driven renderer
 * ========================= */

function SchemaDrivenRenderer({ data, schema }: { data: any; schema: any | null }) {
  if (!schema) {
    return <PreFallback title="Schema not available (showing raw JSON)" data={data} />;
  }

  // If schema says "object" at root, render object; if "array", render array
  const type = schema.type ?? inferType(data);

  if (type === "array") {
    return <RenderArray data={Array.isArray(data) ? data : []} itemSchema={schema.items} />;
  }

  if (type === "object") {
    return <RenderObject data={isPlainObject(data) ? data : {}} objSchema={schema} />;
  }

  // Primitive or unknown
  return <PreFallback title="Preview" data={data} />;
}

/* ---------- Array renderer ---------- */
function RenderArray({ data, itemSchema }: { data: any[]; itemSchema: any }) {
  // If items are objects with stable property set, show table
  const rows = data;
  const first = rows[0];
  const firstProps = isPlainObject(first) ? Object.keys(first) : [];

  const isUniformObjectArray =
    rows.length > 0 &&
    isPlainObject(first) &&
    rows.every((r) => isPlainObject(r) && shallowSameKeys(Object.keys(r), firstProps));

  if (isUniformObjectArray && firstProps.length > 0) {
    return (
      <div className="rounded-xl border border-neutral-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-neutral-950 text-neutral-400">
            <tr>
              {firstProps.map((h) => (
                <th key={h} className="text-left p-2">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-t border-neutral-800">
                {firstProps.map((h) => (
                  <td key={h} className="p-2 align-top">
                    {renderCell(r[h])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  // Non-uniform or primitive array -> list of cards
  return (
    <div className="grid grid-cols-1 gap-3">
      {rows.map((r, i) => (
        <div key={i} className="rounded-xl border border-neutral-800 p-3 bg-neutral-950/50">
          {isPlainObject(r) ? (
            <RenderObject data={r} objSchema={itemSchema || {}} />
          ) : (
            <code className="text-xs">{String(r)}</code>
          )}
        </div>
      ))}
    </div>
  );
}

/* ---------- Object renderer ---------- */
function RenderObject({ data, objSchema }: { data: Record<string, any>; objSchema: any }) {
  // Order props using schema.properties if available; else natural order
  const order = objSchema?.properties ? Object.keys(objSchema.properties) : Object.keys(data);

  // Special case: if the object looks like a document with a big array field (e.g. endpoints), prefer a primary table
  const arrayKeys = order.filter((k) => Array.isArray(data[k]));
  const primaryArrayKey =
    arrayKeys.find((k) => isUniformObjectArray(data[k])) || arrayKeys[0];

  return (
    <div className="space-y-4">
      {/* Show scalar fields as key/value */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {order
          .filter((k) => !Array.isArray(data[k]) && !isPlainObject(data[k]))
          .map((k) => (
            <KeyValue key={k} k={k} v={data[k]} />
          ))}
      </div>

      {/* Show nested objects as sub-cards */}
      {order
        .filter((k) => isPlainObject(data[k]))
        .map((k) => (
          <div key={k} className="rounded-xl border border-neutral-800 p-3">
            <div className="text-xs uppercase tracking-wide text-neutral-400 mb-2">{k}</div>
            <RenderObject data={data[k]} objSchema={objSchema?.properties?.[k] ?? {}} />
          </div>
        ))}

      {/* If there is a prominent array, render it prominently as table */}
      {primaryArrayKey && Array.isArray(data[primaryArrayKey]) && (
        <div className="space-y-2">
          <div className="text-xs uppercase tracking-wide text-neutral-400">{primaryArrayKey}</div>
          <RenderArray
            data={data[primaryArrayKey]}
            itemSchema={objSchema?.properties?.[primaryArrayKey]?.items}
          />
        </div>
      )}

      {/* Render any remaining arrays as lists */}
      {arrayKeys
        .filter((k) => k !== primaryArrayKey)
        .map((k) => (
          <div key={k} className="space-y-2">
            <div className="text-xs uppercase tracking-wide text-neutral-400">{k}</div>
            <RenderArray data={data[k]} itemSchema={objSchema?.properties?.[k]?.items} />
          </div>
        ))}
    </div>
  );
}

/* ---------- Small pieces ---------- */
function KeyValue({ k, v }: { k: string; v: any }) {
  return (
    <div className="rounded-xl border border-neutral-800 p-3 bg-neutral-950/40">
      <div className="text-xs uppercase tracking-wide text-neutral-400">{k}</div>
      <div className="text-sm mt-0.5">{renderInline(v)}</div>
    </div>
  );
}

function PreFallback({ title, data }: { title: string; data: unknown }) {
  return (
    <div className="space-y-2">
      <div className="text-xs uppercase tracking-wide text-neutral-400">{title}</div>
      <pre className="text-xs bg-neutral-950/60 rounded p-2 overflow-auto">{safeJSON(data)}</pre>
    </div>
  );
}

/* ---------- helpers ---------- */
function safeJSON(data: unknown) {
  try {
    return JSON.stringify(data, null, 2);
  } catch {
    return String(data);
  }
}
function isPlainObject(v: any) {
  return v && typeof v === "object" && !Array.isArray(v);
}
function inferType(v: any): "object" | "array" | "primitive" {
  if (Array.isArray(v)) return "array";
  if (isPlainObject(v)) return "object";
  return "primitive";
}
function shallowSameKeys(a: string[], b: string[]) {
  if (a.length !== b.length) return false;
  const sa = new Set(a),
    sb = new Set(b);
  for (const k of sa) if (!sb.has(k)) return false;
  return true;
}
function isUniformObjectArray(arr: any[]) {
  if (!(Array.isArray(arr) && arr.length)) return false;
  const keys = isPlainObject(arr[0]) ? Object.keys(arr[0]) : [];
  if (!keys.length) return false;
  return arr.every((r) => isPlainObject(r) && shallowSameKeys(Object.keys(r), keys));
}
function renderInline(v: any) {
  if (v === null || v === undefined) return <span className="text-neutral-500">—</span>;
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean")
    return <span>{String(v)}</span>;
  return <code className="text-xs">{safeJSON(v)}</code>;
}
function renderCell(v: any) {
  if (v === null || v === undefined) return <span className="text-neutral-500">—</span>;
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean")
    return <span className="whitespace-pre-wrap">{String(v)}</span>;
  if (Array.isArray(v))
    return (
      <span>
        {v.map((x, i) => (
          <span key={i}>
            {String(x)}
            {i < v.length - 1 ? ", " : ""}
          </span>
        ))}
      </span>
    );
  return <code className="text-[11px]">{safeJSON(v)}</code>;
}
