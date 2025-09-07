/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useMemo, useState } from "react";
import { useRainaStore } from "@/stores/useRainaStore";
import { Button } from "@/components/ui/button";
import { callHost } from "@/lib/host";

/**
 * ArtifactView (no History tab)
 * - Single component that renders ANY artifact based on its JSON Schema.
 * - Special handling for cam.diagram.* kinds (Draw.io):
 *    • Shows language + quick preview (nodes/edges tables, XML preview)
 *    • Header-only "Open in Draw.io" button (no duplicate in body)
 * - Otherwise falls back to schema-driven rendering.
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
        reg?.schema_versions?.find((v: any) => v.version === reg.latest_schema_version) ??
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

  const isDiagram = (artifact.kind || "").startsWith("cam.diagram.");
  const lang = (artifact.data as any)?.language;
  const isDrawio = isDiagram && lang === "drawio";
  const drawioXml = (artifact.data as any)?.instructions ?? "";

  // Plain functions with internal guards (no hooks after early return)
  const handleRefresh = () => {
    if (!artifact) return;
    return refreshArtifact(artifact.artifact_id);
  };

  const handleOpenDrawio = () => {
    if (!artifact) return;
    const title = artifact.name || "Diagram";
    const xml = String(drawioXml ?? "");
    return callHost<{ ok: boolean }>({
      type: "raina.openDrawio",
      payload: { title, xml },
    });
  };

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
          {isDrawio && (
            <Button size="sm" onClick={handleOpenDrawio}>
              Open in Draw.io
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={handleRefresh}>
            Refresh
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {isDrawio ? (
          <DrawioDiagramRenderer data={artifact.data} />
        ) : (
          <SchemaDrivenRenderer data={artifact.data} schema={schema} />
        )}
      </div>

      <div className="px-4 py-2 border-t border-neutral-800 text-xs text-neutral-500">
        Workspace: {wsDoc?.workspace?.name ?? "—"} • Version: {String(artifact.version ?? "1")}
      </div>
    </div>
  );
}

/* =========================
 * Draw.io (diagram) renderer
 * ========================= */

function DrawioDiagramRenderer({ data }: { data: any }) {
  const xml: string = data?.instructions ?? "";
  const hasMx = typeof xml === "string" && /<mxfile[\s>]/i.test(xml);
  const nodes = Array.isArray(data?.nodes) ? data.nodes : [];
  const edges = Array.isArray(data?.edges) ? data.edges : [];

  return (
    <div className="space-y-4">
      {/* Quick meta row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        <KeyValue k="doc_type" v={data?.doc_type ?? "—"} />
        <KeyValue k="language" v={data?.language ?? "—"} />
      </div>

      {/* Nodes table */}
      {nodes.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs uppercase tracking-wide text-neutral-400">nodes</div>
          <div className="rounded-xl border border-neutral-800 overflow-auto">
            <RenderArray data={nodes} itemSchema={null} />
          </div>
        </div>
      )}

      {/* Edges table */}
      {edges.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs uppercase tracking-wide text-neutral-400">edges</div>
          <div className="rounded-xl border border-neutral-800 overflow-auto">
            <RenderArray data={edges} itemSchema={null} />
          </div>
        </div>
      )}

      {/* XML preview (collapsed by default) */}
      <XMLPreview title={hasMx ? "Draw.io XML (instructions)" : "Instructions"} xml={xml} />
    </div>
  );
}

function XMLPreview({ title, xml }: { title: string; xml: string }) {
  const [open, setOpen] = useState(false);
  const shown = (xml || "").split("\n").slice(0, open ? undefined : 18).join("\n");
  const truncated = (xml || "").split("\n").length > 18;

  return (
    <div className="rounded-xl border border-neutral-800 p-3 bg-neutral-950/50">
      <div className="flex items-center justify-between">
        <div className="text-xs uppercase tracking-wide text-neutral-400">{title}</div>
        {truncated && (
          <Button variant="ghost" size="sm" onClick={() => setOpen((s) => !s)}>
            {open ? "Collapse" : "Expand"}
          </Button>
        )}
      </div>
      <pre className="text-xs mt-2 bg-neutral-950/60 rounded p-2 overflow-auto">
        {shown || "—"}
      </pre>
    </div>
  );
}

/* =========================
 * Schema-driven renderer (fallback)
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

  // Special case: if the object looks like a document with a big array field, prefer a primary table
  const arrayKeys = order.filter((k) => Array.isArray(data[k]));
  const primaryArrayKey =
    arrayKeys.find((k) => isUniformObjectArray(data[k])) || arrayKeys[0];

  return (
    <div className="space-y-4">
      {/* Scalars */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {order
          .filter((k) => !Array.isArray(data[k]) && !isPlainObject(data[k]))
          .map((k) => (
            <KeyValue key={k} k={k} v={data[k]} />
          ))}
      </div>

      {/* Nested objects */}
      {order
        .filter((k) => isPlainObject(data[k]))
        .map((k) => (
          <div key={k} className="rounded-xl border border-neutral-800 p-3">
            <div className="text-xs uppercase tracking-wide text-neutral-400 mb-2">{k}</div>
            <RenderObject data={data[k]} objSchema={objSchema?.properties?.[k] ?? {}} />
          </div>
        ))}

      {/* Primary array */}
      {primaryArrayKey && Array.isArray(data[primaryArrayKey]) && (
        <div className="space-y-2">
          <div className="text-xs uppercase tracking-wide text-neutral-400">{primaryArrayKey}</div>
          <div className="rounded-xl border border-neutral-800 overflow-auto">
            <RenderArray
              data={data[primaryArrayKey]}
              itemSchema={objSchema?.properties?.[primaryArrayKey]?.items}
            />
          </div>
        </div>
      )}

      {/* Other arrays */}
      {arrayKeys
        .filter((k) => k !== primaryArrayKey)
        .map((k) => (
          <div key={k} className="space-y-2">
            <div className="text-xs uppercase tracking-wide text-neutral-400">{k}</div>
            <div className="rounded-xl border border-neutral-800 overflow-auto">
              <RenderArray data={data[k]} itemSchema={objSchema?.properties?.[k]?.items} />
            </div>
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

/** Pretty inline renderer for scalars or small objects */
function renderInline(v: any) {
  if (v === null || v === undefined) return <span className="text-neutral-500">—</span>;
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean")
    return <span>{String(v)}</span>;
  return <code className="text-xs">{safeJSON(v)}</code>;
}

/** Table-cell renderer that understands arrays of objects */
function renderCell(v: any) {
  if (v === null || v === undefined) return <span className="text-neutral-500">—</span>;
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean")
    return <span className="whitespace-pre-wrap">{String(v)}</span>;

  if (Array.isArray(v)) {
    if (v.length === 0) return <span className="text-neutral-500">—</span>;
    const allObjects = v.every(isPlainObject);

    // Render common "fields" pattern as chips: name:type?
    if (allObjects && v[0] && ("name" in v[0]) && ("type" in v[0])) {
      return (
        <div className="flex flex-wrap gap-1.5">
          {v.map((f: any, i: number) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 rounded-md bg-neutral-900 px-2 py-0.5 border border-neutral-800 text-[11px]"
              title={safeJSON(f)}
            >
              <span className="font-medium">{String(f.name)}</span>
              <span className="text-neutral-500">:</span>
              <span className="font-mono">{String(f.type)}{f.nullable ? "?" : ""}</span>
            </span>
          ))}
        </div>
      );
    }

    // Generic array of objects -> tiny inline table
    if (allObjects) {
      const first = v[0] || {};
      const keys = Object.keys(first);

      // Prefer readable columns first
      const prefOrder = ["name", "type", "nullable", "description", "id", "kind"];
      const cols = [
        ...prefOrder.filter((k) => keys.includes(k)),
        ...keys.filter((k) => !prefOrder.includes(k)),
      ].slice(0, 6); // cap to avoid very wide cells

      return (
        <div className="max-h-40 overflow-auto rounded-md border border-neutral-800">
          <table className="min-w-full text-[11px]">
            <thead className="bg-neutral-950 text-neutral-400">
              <tr>
                {cols.map((c) => (
                  <th key={c} className="text-left px-2 py-1">{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {v.map((row: any, i: number) => (
                <tr key={i} className="border-t border-neutral-800">
                  {cols.map((c) => (
                    <td key={c} className="px-2 py-1 align-top">
                      {renderCell(row[c])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    // Primitive arrays
    return (
      <span className="whitespace-pre-wrap">
        {v.map((x, i) => (
          <span key={i}>
            {String(x)}
            {i < v.length - 1 ? ", " : ""}
          </span>
        ))}
      </span>
    );
  }

  // Fallback for objects: short JSON
  if (isPlainObject(v)) {
    return <code className="text-[11px]">{safeJSON(v)}</code>;
  }

  return <span className="whitespace-pre-wrap">{String(v)}</span>;
}
