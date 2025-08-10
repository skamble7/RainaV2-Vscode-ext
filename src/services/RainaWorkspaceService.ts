// src/services/RainaWorkspaceService.ts
/* eslint-disable curly */
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

const API_BASE = "http://127.0.0.1:8010";       // workspace-service
const DISCOVERY_BASE = "http://127.0.0.1:8012"; // <-- adjust to your discovery-service port

export const RainaWorkspaceService = {
  async list(): Promise<BackendWorkspace[]> {
    const res = await fetch(`${API_BASE}/workspace/`);
    if (!res.ok) throw new Error(`Failed to list workspaces (${res.status})`);
    const data = (await res.json()) as RawWorkspace[];
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
    const data = (await res.json()) as RawWorkspace;
    return normalizeWorkspace(data);
  },

  // NEW: hydrate detail (workspace + artifacts) from your backend
  async get(id: string) {
    const res = await fetch(`${API_BASE}/workspace/${id}`);
    if (!res.ok) throw new Error(`Failed to get workspace (${res.status})`);
    return await res.json(); // shape: consolidated workspace detail
  },

  // NEW: kick off discovery
  async startDiscovery(workspaceId: string, options?: any) {
    const res = await fetch(`${DISCOVERY_BASE}/discover/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspace_id: workspaceId, ...(options ?? {}) }),
    });
    if (!res.ok) throw new Error(`Failed to start discovery (${res.status})`);
    return await res.json(); // e.g. { runId, status, ... }
  },
};
