/* eslint-disable @typescript-eslint/no-explicit-any */

export type Hint =
  | { widget: "select"; options: string[] }
  | { widget: "textarea"; rows?: number }
  | { widget: "lines" }
  | { widget: "number" }
  | { widget: "boolean" }
  | { widget: "url" }
  | { widget: "code"; rows?: number }
  | { widget: "text" };

export type HintsConfig = {
  // Reorder common keys first
  preferOrder?: string[];
  // JSONPath-lite with [] for any index, dot for keys. (e.g., "services[].style")
  byPath?: Record<string, Hint & { label?: string; readOnly?: boolean; hidden?: boolean }>;
};

const commonOrder = ["title","name","summary","description","contexts","relationships","capabilities","services","endpoints","entities","relations","adrs","sections","source","notation"];

export const hintsByKind: Record<string, HintsConfig> = {
  "cam.document": {
    preferOrder: commonOrder,
    byPath: {
      "title": { widget: "text" },
      "sections[].body": { widget: "textarea", rows: 8 },
      "sections[].title": { widget: "text" },
    },
  },
  "cam.context_map": {
    preferOrder: commonOrder,
    byPath: {
      "contexts[].responsibilities": { widget: "lines" },
      "contexts[].owned_entities": { widget: "lines" },
      "relationships[].notes": { widget: "textarea", rows: 5 },
      "relationships[].style": { widget: "select", options: ["upstream","downstream","partnership"] },
    },
  },
  "cam.capability_model": {
    preferOrder: commonOrder,
    byPath: {
      "capabilities[].description": { widget: "textarea", rows: 5 },
      "capabilities[].children": { widget: "lines" }, // names list works well
    },
  },
  "cam.service_contract": {
    preferOrder: commonOrder,
    byPath: {
      "service": { widget: "text" },
      "endpoints[].method": { widget: "select", options: ["GET","POST","PUT","PATCH","DELETE"] },
      "endpoints[].path": { widget: "text" },
      "endpoints[].in.brief": { widget: "text" },
      "endpoints[].out.brief": { widget: "text" },
    },
  },
  "cam.sequence_diagram": {
    preferOrder: commonOrder,
    byPath: {
      "notation": { widget: "select", options: ["mermaid","plantuml"] },
      "source": { widget: "code", rows: 12 },
    },
  },
  "cam.erd": {
    preferOrder: commonOrder,
    byPath: {
      "entities[].fields[].type": { widget: "text" },
      "relations[].type": { widget: "select", options: ["one-to-one","one-to-many","many-to-one","many-to-many"] },
    },
  },
  "cam.adr_index": {
    preferOrder: commonOrder,
    byPath: {
      "adrs[].status": { widget: "select", options: ["Proposed","Accepted","Rejected","Superseded","Deprecated"] },
      "adrs[].date": { widget: "text" },
    },
  },
  // Back-compat: many of your existing docs are cam.document with doc_type.
  "api_contracts@doc": {
    preferOrder: commonOrder,
    byPath: {
      "services[].style": { widget: "select", options: ["rest","grpc"] },
      "services[].openapi": { widget: "url" },
      "services[].grpc_idl": { widget: "url" },
    },
  },
};

export function pathKey(path: (string|number)[]): string {
  // numbers -> [] so "services.0.style" -> "services[].style"
  return path.map(p => (typeof p === "number" ? "[]" : String(p))).join(".");
}

export function getHint(kind: string, path: (string|number)[], value: any): Hint | undefined {
  const key = pathKey(path);
  const cfg = hintsByKind[kind] ?? {};
  const byPath = cfg.byPath ?? {};
  if (byPath[key]) return byPath[key];

  // Generic fallbacks
  if (typeof value === "boolean") return { widget: "boolean" };
  if (typeof value === "number") return { widget: "number" };
  if (typeof value === "string") {
    if (/^https?:\/\//i.test(value)) return { widget: "url" };
    if (/(\bbody\b|\bnotes?\b|\bdescription\b)/i.test(String(path[path.length-1] ?? ""))) return { widget: "textarea", rows: 6 };
    if (/(\bsource\b|\bopenapi\b|\bgrpc_idl\b)/i.test(String(path[path.length-1] ?? ""))) return { widget: "code", rows: 10 };
    return { widget: "text" };
  }
  return undefined;
}

export function preferredOrder(kind: string) {
  return (hintsByKind[kind]?.preferOrder ?? commonOrder).slice();
}
