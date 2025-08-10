// src/services/RainaWorkspaceService.ts
/* eslint-disable curly */
export type BackendWorkspace = {
  id: string;
  name: string;
  description?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
};

const API_BASE = "http://127.0.0.1:8010";

export const RainaWorkspaceService = {
  async list(): Promise<BackendWorkspace[]> {
    const res = await fetch(`${API_BASE}/workspace/`);
    if (!res.ok) throw new Error(`Failed to list workspaces (${res.status})`);
    const data = await res.json();
    if (!Array.isArray(data)) throw new Error("Expected array of workspaces");
    return data as BackendWorkspace[];
  },

  async create(payload: { name: string; description?: string; created_by?: string }) {
    const res = await fetch(`${API_BASE}/workspace/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Failed to create workspace (${res.status})`);
    const data = await res.json();
    if (typeof data !== "object" || data === null) throw new Error("Expected a workspace object");
    return data as BackendWorkspace;
  },
};
