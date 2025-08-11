"use strict";
// src/services/RainaWorkspaceService.ts
/* eslint-disable curly */
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
const ARTIFACT_BASE = "http://127.0.0.1:8011"; // artifact-service
const DISCOVERY_BASE = "http://127.0.0.1:8013"; // discovery-service
// --- helpers ---
async function json(res) {
    const text = await res.text();
    return text ? JSON.parse(text) : undefined;
}
function qs(params) {
    const u = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
        if (v === undefined || v === null)
            continue;
        u.set(k, String(v));
    }
    const s = u.toString();
    return s ? `?${s}` : "";
}
function getEtag(h) {
    return h.get("ETag") ?? h.get("etag") ?? undefined; // safety for case variance
}
exports.RainaWorkspaceService = {
    // ----------------- Workspaces -----------------
    async list() {
        const res = await fetch(`${API_BASE}/workspace/`);
        if (!res.ok)
            throw new Error(`Failed to list workspaces (${res.status})`);
        const data = (await json(res)) ?? [];
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
        const data = await json(res);
        return normalizeWorkspace(data);
    },
    // Hydrate consolidated doc (workspace + artifacts) from artifact-service
    async get(workspaceId) {
        const url = `${ARTIFACT_BASE}/artifact/${workspaceId}/parent?include_deleted=false`;
        const res = await fetch(url);
        if (!res.ok)
            throw new Error(`Failed to get workspace detail (${res.status})`);
        const body = await json(res);
        return body; // shape matches artifact-service parent response
    },
    // Update workspace metadata (name/description)
    async update(id, patch) {
        const res = await fetch(`${API_BASE}/workspace/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(patch),
        });
        if (!res.ok)
            throw new Error(`Failed to update workspace (${res.status})`);
        return await json(res);
    },
    // ----------------- Artifacts -----------------
    // Create artifact
    async createArtifact(workspaceId, payload) {
        const res = await fetch(`${ARTIFACT_BASE}/artifact/${workspaceId}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
        if (!res.ok)
            throw new Error(`Failed to create artifact (${res.status})`);
        const etag = getEtag(res.headers);
        const data = await json(res);
        console.log("[EXT] artifact:create ← ETag", { workspaceId, etag });
        return { data, etag };
    },
    // List artifacts with optional filters
    async listArtifacts(workspaceId, opts) {
        const url = `${ARTIFACT_BASE}/artifact/${workspaceId}${qs({
            kind: opts?.kind,
            name_prefix: opts?.name_prefix,
            limit: opts?.limit,
            offset: opts?.offset,
            include_deleted: opts?.include_deleted ?? false,
        })}`;
        const res = await fetch(url);
        if (!res.ok)
            throw new Error(`Failed to list artifacts (${res.status})`);
        return await json(res);
    },
    // Read one (returns body + ETag)
    async getArtifact(workspaceId, artifactId) {
        const res = await fetch(`${ARTIFACT_BASE}/artifact/${workspaceId}/${artifactId}`);
        if (!res.ok)
            throw new Error(`Failed to get artifact (${res.status})`);
        const etag = getEtag(res.headers);
        const data = await json(res);
        console.log("[EXT] artifact:get ← ETag", { workspaceId, artifactId, etag });
        return { data, etag };
    },
    // HEAD for ETag only
    async headArtifact(workspaceId, artifactId) {
        const res = await fetch(`${ARTIFACT_BASE}/artifact/${workspaceId}/${artifactId}`, { method: "HEAD" });
        if (!res.ok)
            throw new Error(`Failed to head artifact (${res.status})`);
        const etag = getEtag(res.headers);
        console.log("[EXT] artifact:head ← ETag", { workspaceId, artifactId, etag });
        return etag;
    },
    // JSON Patch on data (requires If-Match)
    async patchArtifact(workspaceId, artifactId, etag, patch, provenance) {
        console.log("[EXT] artifact:patch → If-Match", { artifactId, ifMatch: etag });
        const res = await fetch(`${ARTIFACT_BASE}/artifact/${workspaceId}/${artifactId}/patch`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "If-Match": etag },
            body: JSON.stringify({ patch, provenance }),
        });
        const newEtag = getEtag(res.headers);
        console.log("[EXT] artifact:patch ← ETag/status", { artifactId, newEtag, status: res.status });
        if (res.status === 412)
            throw new Error("PRECONDITION_FAILED");
        if (!res.ok)
            throw new Error(`Failed to patch artifact (${res.status})`);
        const data = await json(res);
        return { data, etag: newEtag };
    },
    // Replace entire data (requires If-Match)
    async replaceArtifact(workspaceId, artifactId, etag, dataPayload, provenance) {
        console.log("[EXT] artifact:replace → If-Match", { artifactId, ifMatch: etag });
        const res = await fetch(`${ARTIFACT_BASE}/artifact/${workspaceId}/${artifactId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json", "If-Match": etag },
            body: JSON.stringify({ data: dataPayload, provenance }),
        });
        const newEtag = getEtag(res.headers);
        console.log("[EXT] artifact:replace ← ETag/status", { artifactId, newEtag, status: res.status });
        if (res.status === 412)
            throw new Error("PRECONDITION_FAILED");
        if (!res.ok)
            throw new Error(`Failed to replace artifact (${res.status})`);
        const data = await json(res);
        return { data, etag: newEtag };
    },
    // Soft delete
    async deleteArtifact(workspaceId, artifactId) {
        const res = await fetch(`${ARTIFACT_BASE}/artifact/${workspaceId}/${artifactId}`, { method: "DELETE" });
        console.log("[EXT] artifact:delete ← status", { artifactId, status: res.status });
        if (!(res.ok || res.status === 204))
            throw new Error(`Failed to delete artifact (${res.status})`);
    },
    // History (list patches)
    async history(workspaceId, artifactId) {
        const res = await fetch(`${ARTIFACT_BASE}/artifact/${workspaceId}/${artifactId}/history`);
        if (!res.ok)
            throw new Error(`Failed to fetch history (${res.status})`);
        const data = await json(res);
        console.log("[EXT] artifact:history", { artifactId, count: Array.isArray(data) ? data.length : undefined });
        return data;
    },
    // ----------------- Discovery -----------------
    async startDiscovery(workspaceId, options) {
        const res = await fetch(`${DISCOVERY_BASE}/discover/start`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ workspace_id: workspaceId, ...(options ?? {}) }),
        });
        if (!res.ok)
            throw new Error(`Failed to start discovery (${res.status})`);
        const data = await json(res); // e.g. { runId, status, ... }
        console.log("[EXT] discovery:start", { workspaceId, ...data });
        return data;
    },
};
//# sourceMappingURL=RainaWorkspaceService.js.map