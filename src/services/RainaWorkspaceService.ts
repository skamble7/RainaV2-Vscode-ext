/* eslint-disable curly */
/* eslint-disable @typescript-eslint/no-explicit-any */
//src/services/RainaWorkspaceService.ts
export type RawWorkspace = {
  id?: string;
  _id?: string;
  name: string;
  description?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
};

export type BackendWorkspace = {
  id: string;
  name: string;
  description?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
};

function normalizeWorkspace(w: RawWorkspace): BackendWorkspace {
  const id = w.id ?? w._id;
  if (!id) throw new Error("Workspace missing id/_id");
  return {
    id,
    name: w.name,
    description: w.description ?? null,
    created_by: w.created_by ?? null,
    created_at: w.created_at,
    updated_at: w.updated_at,
  };
}

const API_BASE = "http://127.0.0.1:8010"; // workspace-service
const ARTIFACT_BASE = "http://127.0.0.1:8011"; // artifact-service
const DISCOVERY_BASE = "http://127.0.0.1:8013"; // discovery-service

// --- helpers ---
async function json<T = any>(res: Response): Promise<T> {
  const text = await res.text();
  return text ? (JSON.parse(text) as T) : (undefined as any);
}
function qs(params: Record<string, any | undefined>) {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    u.set(k, String(v));
  }
  const s = u.toString();
  return s ? `?${s}` : "";
}
function getEtag(h: Headers) {
  return h.get("ETag") ?? h.get("etag") ?? undefined;
}

/* ---------------------------- Discovery Run Types ---------------------------- */

export type RunStatus = "created" | "pending" | "running" | "completed" | "failed" | "canceled";

export type DiscoveryRun = {
  run_id: string;
  workspace_id: string;
  playbook_id: string;
  model_id?: string;
  status: RunStatus;
  started_at?: string;
  finished_at?: string;

  // NEW for baseline UI
  inputs?: any;
  input_diff?: any;
  strategy?: string;

  result_summary?: any;
  title?: string | null;
  description?: string | null;
  error?: string | null;
  artifacts?: any[];
  deltas?: { counts?: Partial<Record<"new" | "updated" | "unchanged" | "retired" | "deleted", number>> };
};

export type StartDiscoveryResponse = {
  accepted: boolean;
  run_id: string;
  workspace_id: string;
  playbook_id: string;
  model_id?: string;
  dry_run?: boolean;
  request_id?: string;
  correlation_id?: string;
  message?: string;
};

export const RainaWorkspaceService = {
  // ----------------- Workspaces -----------------
  async list(): Promise<BackendWorkspace[]> {
    const res = await fetch(`${API_BASE}/workspace/`);
    if (!res.ok) throw new Error(`Failed to list workspaces (${res.status})`);
    const data = (await json<RawWorkspace[]>(res)) ?? [];
    if (!Array.isArray(data)) throw new Error("Expected array of workspaces");
    return data.map(normalizeWorkspace);
  },

  async create(payload: { name: string; description?: string; created_by?: string }) {
    const res = await fetch(`${API_BASE}/workspace/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Failed to create workspace (${res.status})`);
    const data = await json<RawWorkspace>(res);
    return normalizeWorkspace(data);
  },

  // Hydrate consolidated doc (workspace + artifacts) from artifact-service
  async get(workspaceId: string) {
    const url = `${ARTIFACT_BASE}/artifact/${workspaceId}/parent?include_deleted=false`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to get workspace detail (${res.status})`);
    const body = await json(res);
    return body;
  },

  // Update workspace metadata (name/description)
  async update(id: string, patch: { name?: string; description?: string }) {
    const res = await fetch(`${API_BASE}/workspace/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) throw new Error(`Failed to update workspace (${res.status})`);
    return await json(res);
  },

  // ----------------- Artifacts -----------------
  async createArtifact(
    workspaceId: string,
    payload: { kind: string; name: string; data: any; provenance?: Record<string, any> }
  ) {
    const res = await fetch(`${ARTIFACT_BASE}/artifact/${workspaceId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Failed to create artifact (${res.status})`);
    const etag = getEtag(res.headers);
    const data = await json(res);
    console.log("[EXT] artifact:create ← ETag", { workspaceId, etag });
    return { data, etag };
  },

  async listArtifacts(
    workspaceId: string,
    opts?: {
      kind?: string;
      name_prefix?: string;
      limit?: number;
      offset?: number;
      include_deleted?: boolean;
    }
  ) {
    const url = `${ARTIFACT_BASE}/artifact/${workspaceId}${qs({
      kind: opts?.kind,
      name_prefix: opts?.name_prefix,
      limit: opts?.limit,
      offset: opts?.offset,
      include_deleted: opts?.include_deleted ?? false,
    })}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to list artifacts (${res.status})`);
    return await json(res);
  },

  async getArtifact(workspaceId: string, artifactId: string) {
    const res = await fetch(`${ARTIFACT_BASE}/artifact/${workspaceId}/${artifactId}`);
    if (!res.ok) throw new Error(`Failed to get artifact (${res.status})`);
    const etag = getEtag(res.headers);
    const data = await json(res);
    console.log("[EXT] artifact:get ← ETag", { workspaceId, artifactId, etag });
    return { data, etag };
  },

  async headArtifact(workspaceId: string, artifactId: string) {
    const res = await fetch(`${ARTIFACT_BASE}/artifact/${workspaceId}/${artifactId}`, { method: "HEAD" });
    if (!res.ok) throw new Error(`Failed to head artifact (${res.status})`);
    const etag = getEtag(res.headers);
    console.log("[EXT] artifact:head ← ETag", { workspaceId, artifactId, etag });
    return etag;
  },

  async patchArtifact(
    workspaceId: string,
    artifactId: string,
    etag: string,
    patch: any[],
    provenance?: Record<string, any>
  ) {
    console.log("[EXT] artifact:patch → If-Match", { artifactId, ifMatch: etag });
    const res = await fetch(`${ARTIFACT_BASE}/artifact/${workspaceId}/${artifactId}/patch`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "If-Match": etag },
      body: JSON.stringify({ patch, provenance }),
    });
    const newEtag = getEtag(res.headers);
    console.log("[EXT] artifact:patch ← ETag/status", { artifactId, newEtag, status: res.status });
    if (res.status === 412) throw new Error("PRECONDITION_FAILED");
    if (!res.ok) throw new Error(`Failed to patch artifact (${res.status})`);
    const data = await json(res);
    return { data, etag: newEtag };
  },

  async replaceArtifact(
    workspaceId: string,
    artifactId: string,
    etag: string,
    dataPayload: any,
    provenance?: Record<string, any>
  ) {
    console.log("[EXT] artifact:replace → If-Match", { artifactId, ifMatch: etag });
    const res = await fetch(`${ARTIFACT_BASE}/artifact/${workspaceId}/${artifactId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", "If-Match": etag },
      body: JSON.stringify({ data: dataPayload, provenance }),
    });
    const newEtag = getEtag(res.headers);
    console.log("[EXT] artifact:replace ← ETag/status", { artifactId, newEtag, status: res.status });
    if (res.status === 412) throw new Error("PRECONDITION_FAILED");
    if (!res.ok) throw new Error(`Failed to replace artifact (${res.status})`);
    const data = await json(res);
    return { data, etag: newEtag };
  },

  async deleteArtifact(workspaceId: string, artifactId: string) {
    const res = await fetch(`${ARTIFACT_BASE}/artifact/${workspaceId}/${artifactId}`, { method: "DELETE" });
    console.log("[EXT] artifact:delete ← status", { artifactId, status: res.status });
    if (!(res.ok || res.status === 204)) throw new Error(`Failed to delete artifact (${res.status})`);
  },

  async history(workspaceId: string, artifactId: string) {
    const res = await fetch(`${ARTIFACT_BASE}/artifact/${workspaceId}/${artifactId}/history`);
    if (!res.ok) throw new Error(`Failed to fetch history (${res.status})`);
    const data = await json(res);
    console.log("[EXT] artifact:history", { artifactId, count: Array.isArray(data) ? data.length : undefined });
    return data;
  },

  // ----------------- Discovery (Start a run) -----------------
  async startDiscovery(workspaceId: string, requestBody?: any): Promise<StartDiscoveryResponse | undefined> {
    const url = `${DISCOVERY_BASE}/discover/${workspaceId}`;
    const bodyJson = JSON.stringify(requestBody ?? {});
    console.log("[EXT] discovery:start →", url);
    console.log("[EXT] discovery:start → body\n", bodyJson);

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: bodyJson,
    });

    const text = await res.text().catch(() => "");
    console.log("[EXT] discovery:start ←", res.status, res.statusText);
    console.log("[EXT] discovery:start ← body\n", text);

    if (!res.ok) throw new Error(`Failed to start discovery (${res.status}) ${text}`);
    return text ? (JSON.parse(text) as StartDiscoveryResponse) : undefined;
  },

  // ----------------- Runs (List/Get/Delete) -----------------
  async listRuns(workspaceId: string, opts?: { limit?: number; offset?: number }): Promise<DiscoveryRun[]> {
    const url = `${DISCOVERY_BASE}/runs${qs({
      workspace_id: workspaceId,
      limit: opts?.limit,
      offset: opts?.offset,
    })}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to list runs (${res.status})`);
    const data = await json<DiscoveryRun[]>(res);
    return Array.isArray(data) ? data : [];
  },

  async getRun(runId: string): Promise<DiscoveryRun> {
    const res = await fetch(`${DISCOVERY_BASE}/runs/${runId}`);
    if (!res.ok) throw new Error(`Failed to get run (${res.status})`);
    return await json<DiscoveryRun>(res);
  },

  async deleteRun(runId: string): Promise<void> {
    const res = await fetch(`${DISCOVERY_BASE}/runs/${runId}`, { method: "DELETE" });
    if (!(res.ok || res.status === 204)) throw new Error(`Failed to delete run (${res.status})`);
  },

  // ----------------- Baseline (NEW) -----------------
  async setBaselineInputs(
    workspaceId: string,
    inputs: { avc?: any; fss?: any; pss?: any },
    opts?: { ifAbsentOnly?: boolean; expectedVersion?: number }
  ): Promise<any> {
    const url = `${ARTIFACT_BASE}/artifact/${workspaceId}/baseline-inputs${qs({
      if_absent_only: opts?.ifAbsentOnly ? "true" : undefined,
      expected_version: opts?.expectedVersion,
    })}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(inputs ?? {}),
    });
    if (!res.ok) throw new Error(`Failed to set baseline (${res.status})`);
    return await json(res);
  },

  async patchBaselineInputs(
    workspaceId: string,
    payload: {
      avc?: any;
      pss?: any;
      fss_stories_upsert?: any[];
      expectedVersion?: number;
    }
  ): Promise<any> {
    const url = `${ARTIFACT_BASE}/artifact/${workspaceId}/baseline-inputs${qs({
      expected_version: payload?.expectedVersion,
    })}`;
    const body = {
      avc: payload.avc,
      pss: payload.pss,
      fss_stories_upsert: payload.fss_stories_upsert,
    };
    const res = await fetch(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Failed to patch baseline (${res.status})`);
    return await json(res);
  },
};
