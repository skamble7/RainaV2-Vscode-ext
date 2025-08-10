"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RainaWorkspaceService = void 0;
const API_BASE = "http://127.0.0.1:8010";
exports.RainaWorkspaceService = {
    async list() {
        const res = await fetch(`${API_BASE}/workspace/`);
        if (!res.ok)
            throw new Error(`Failed to list workspaces (${res.status})`);
        const data = await res.json();
        if (!Array.isArray(data))
            throw new Error("Expected array of workspaces");
        return data;
    },
    async create(payload) {
        const res = await fetch(`${API_BASE}/workspace/`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
        if (!res.ok)
            throw new Error(`Failed to create workspace (${res.status})`);
        const data = await res.json();
        if (typeof data !== "object" || data === null)
            throw new Error("Expected a workspace object");
        return data;
    },
};
//# sourceMappingURL=RainaWorkspaceService.js.map