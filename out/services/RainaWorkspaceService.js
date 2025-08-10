"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RainaWorkspaceService = void 0;
function normalizeWorkspace(w) {
    const id = w.id ?? w._id;
    if (!id)
        throw new Error("Workspace missing id/_id");
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
const DISCOVERY_BASE = "http://127.0.0.1:8012"; // <-- adjust to your discovery-service port
exports.RainaWorkspaceService = {
    async list() {
        const res = await fetch(`${API_BASE}/workspace/`);
        if (!res.ok)
            throw new Error(`Failed to list workspaces (${res.status})`);
        const data = (await res.json());
        if (!Array.isArray(data))
            throw new Error("Expected array of workspaces");
        return data.map(normalizeWorkspace);
    },
    async create(payload) {
        const res = await fetch(`${API_BASE}/workspace/`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
        if (!res.ok)
            throw new Error(`Failed to create workspace (${res.status})`);
        const data = (await res.json());
        return normalizeWorkspace(data);
    },
    // NEW: hydrate detail (workspace + artifacts) from your backend
    async get(id) {
        const res = await fetch(`${API_BASE}/workspace/${id}`);
        if (!res.ok)
            throw new Error(`Failed to get workspace (${res.status})`);
        return await res.json(); // shape: consolidated workspace detail
    },
    // NEW: kick off discovery
    async startDiscovery(workspaceId, options) {
        const res = await fetch(`${DISCOVERY_BASE}/discover/start`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ workspace_id: workspaceId, ...(options ?? {}) }),
        });
        if (!res.ok)
            throw new Error(`Failed to start discovery (${res.status})`);
        return await res.json(); // e.g. { runId, status, ... }
    },
};
//# sourceMappingURL=RainaWorkspaceService.js.map