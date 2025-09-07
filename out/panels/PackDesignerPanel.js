"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.PackDesignerPanel = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const RainaWorkspaceService_1 = require("../services/RainaWorkspaceService");
class PackDesignerPanel {
    static currentPanel;
    panel;
    extensionUri;
    static createOrShow(extensionUri, initial) {
        const column = vscode.ViewColumn.One;
        // Close previous designer tab if open
        if (PackDesignerPanel.currentPanel) {
            PackDesignerPanel.currentPanel.panel.dispose();
        }
        const panel = vscode.window.createWebviewPanel("packDesigner", initial?.key ? `Edit Pack ${initial.key}@${initial.version}` : "New Capability Pack", column, {
            enableScripts: true,
            localResourceRoots: [vscode.Uri.joinPath(extensionUri, "media", "raina-ui")],
            retainContextWhenHidden: true,
        });
        PackDesignerPanel.currentPanel = new PackDesignerPanel(panel, extensionUri, initial);
    }
    constructor(panel, extensionUri, initial) {
        this.panel = panel;
        this.extensionUri = extensionUri;
        this.panel.webview.html = this.getHtmlForWebview(panel.webview, initial);
        this.setMessageListener();
        this.panel.onDidDispose(() => (PackDesignerPanel.currentPanel = undefined));
    }
    postReply(token, ok, data, error) {
        if (!token)
            return; // host.ts only resolves when token matches
        this.panel.webview.postMessage({ token, ok, data, error });
    }
    async routeToService(type, payload) {
        // ---- Workspaces ----
        if (type === "workspace:list")
            return await RainaWorkspaceService_1.RainaWorkspaceService.list();
        if (type === "workspace:create")
            return await RainaWorkspaceService_1.RainaWorkspaceService.create(payload);
        if (type === "workspace:get")
            return await RainaWorkspaceService_1.RainaWorkspaceService.get(payload.id);
        if (type === "workspace:update")
            return await RainaWorkspaceService_1.RainaWorkspaceService.update(payload.id, payload.patch);
        // ---- Artifacts ----
        if (type === "artifact:get")
            return await RainaWorkspaceService_1.RainaWorkspaceService.getArtifact(payload.workspaceId, payload.artifactId);
        if (type === "artifact:head")
            return await RainaWorkspaceService_1.RainaWorkspaceService.headArtifact(payload.workspaceId, payload.artifactId);
        if (type === "artifact:patch")
            return await RainaWorkspaceService_1.RainaWorkspaceService.patchArtifact(payload.workspaceId, payload.artifactId, payload.etag, payload.patch, payload.provenance);
        if (type === "artifact:replace")
            return await RainaWorkspaceService_1.RainaWorkspaceService.replaceArtifact(payload.workspaceId, payload.artifactId, payload.etag, payload.dataPayload, payload.provenance);
        if (type === "artifact:delete")
            return await RainaWorkspaceService_1.RainaWorkspaceService.deleteArtifact(payload.workspaceId, payload.artifactId);
        if (type === "artifact:history")
            return await RainaWorkspaceService_1.RainaWorkspaceService.history(payload.workspaceId, payload.artifactId);
        // ---- Runs ----
        if (type === "runs:list")
            return await RainaWorkspaceService_1.RainaWorkspaceService.listRuns(payload.workspaceId, payload);
        if (type === "runs:get")
            return await RainaWorkspaceService_1.RainaWorkspaceService.getRun(payload.runId);
        if (type === "runs:delete")
            return await RainaWorkspaceService_1.RainaWorkspaceService.deleteRun(payload.runId);
        if (type === "runs:start")
            return await RainaWorkspaceService_1.RainaWorkspaceService.startDiscovery(payload.workspaceId, payload.requestBody);
        // ---- Baseline ----
        if (type === "baseline:set")
            return await RainaWorkspaceService_1.RainaWorkspaceService.setBaselineInputs(payload.workspaceId, payload.inputs, {
                ifAbsentOnly: payload.ifAbsentOnly,
                expectedVersion: payload.expectedVersion,
            });
        if (type === "baseline:patch")
            return await RainaWorkspaceService_1.RainaWorkspaceService.patchBaselineInputs(payload.workspaceId, {
                avc: payload.avc,
                pss: payload.pss,
                fss_stories_upsert: payload.fssStoriesUpsert,
                expectedVersion: payload.expectedVersion,
            });
        /* ================= Capability Registry ================= */
        // Capabilities (global)
        if (type === "capability:list")
            return await RainaWorkspaceService_1.RainaWorkspaceService.capabilityListAll(payload ?? {});
        if (type === "capability:get")
            return await RainaWorkspaceService_1.RainaWorkspaceService.capabilityGet(payload.id);
        if (type === "capability:create")
            return await RainaWorkspaceService_1.RainaWorkspaceService.capabilityCreate(payload);
        if (type === "capability:update")
            return await RainaWorkspaceService_1.RainaWorkspaceService.capabilityUpdate(payload.id, payload.patch);
        if (type === "capability:delete")
            return await RainaWorkspaceService_1.RainaWorkspaceService.capabilityDelete(payload.id);
        // Packs
        if (type === "capability:pack:list")
            return await RainaWorkspaceService_1.RainaWorkspaceService.capabilityPacksList(payload ?? {});
        if (type === "capability:pack:get")
            return await RainaWorkspaceService_1.RainaWorkspaceService.capabilityPackGet(payload.key, payload.version);
        if (type === "capability:pack:create")
            return await RainaWorkspaceService_1.RainaWorkspaceService.capabilityPackCreate(payload);
        if (type === "capability:pack:update")
            return await RainaWorkspaceService_1.RainaWorkspaceService.capabilityPackUpdate(payload.key, payload.version, payload.patch);
        if (type === "capability:pack:delete")
            return await RainaWorkspaceService_1.RainaWorkspaceService.capabilityPackDelete(payload.key, payload.version);
        if (type === "capability:pack:setCaps")
            return await RainaWorkspaceService_1.RainaWorkspaceService.capabilityPackSetCapabilities(payload.key, payload.version, payload.capability_ids);
        if (type === "capability:pack:addPlaybook")
            return await RainaWorkspaceService_1.RainaWorkspaceService.capabilityPackAddPlaybook(payload.key, payload.version, payload.playbook);
        if (type === "capability:pack:removePlaybook")
            return await RainaWorkspaceService_1.RainaWorkspaceService.capabilityPackRemovePlaybook(payload.key, payload.version, payload.playbook_id);
        if (type === "capability:pack:reorderSteps")
            return await RainaWorkspaceService_1.RainaWorkspaceService.capabilityPackReorderSteps(payload.key, payload.version, payload.playbook_id, payload.order);
        // ---- Registry kinds / categories ----
        if (type === "registry:kinds:list")
            return await RainaWorkspaceService_1.RainaWorkspaceService.registryKindsList(payload?.limit, payload?.offset);
        if (type === "registry:kind:get")
            return await RainaWorkspaceService_1.RainaWorkspaceService.registryKindGet(payload.key);
        if (type === "categories:byKeys")
            return await RainaWorkspaceService_1.RainaWorkspaceService.categoriesByKeys(payload.keys ?? []);
        // Unknown → let caller know
        throw new Error(`Unhandled message type: ${type}`);
    }
    setMessageListener() {
        this.panel.webview.onDidReceiveMessage(async (message) => {
            const { type, token, payload } = message ?? {};
            // Panel-local controls
            if (type === "packDesigner:closeAndReturn") {
                this.panel.dispose();
                await vscode.commands.executeCommand("raina.open");
                return;
            }
            // Host bridge: handle callHost(...) requests coming from the designer webview
            try {
                const data = await this.routeToService(type, payload);
                this.postReply(token, true, data, undefined);
            }
            catch (err) {
                const msg = err?.message || String(err);
                // eslint-disable-next-line no-console
                console.warn("[PackDesignerPanel] Host error for", type, msg);
                this.postReply(token, false, undefined, msg);
            }
        });
    }
    getHtmlForWebview(webview, initial) {
        const manifestPath = path.join(this.extensionUri.fsPath, "media", "raina-ui", "manifest.json");
        if (!fs.existsSync(manifestPath)) {
            vscode.window.showErrorMessage("Vite build not found. Run `npm run build` in raina-ui.");
            return "<html><body><h3>Build missing</h3></body></html>";
        }
        const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
        const entryKey = manifest["index.html"] ? "index.html" : Object.keys(manifest)[0];
        const entry = manifest[entryKey];
        const scriptFile = entry.file;
        const cssFile = entry.css?.[0];
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, "media", "raina-ui", scriptFile));
        const styleUri = cssFile
            ? webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, "media", "raina-ui", cssFile))
            : undefined;
        // pass initial key/version into React entrypoint via dataset
        const initPayload = JSON.stringify(initial ?? {});
        return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<style>
  html, body, #root { height:100%; width:100%; }
  body { margin:0; padding:0; background:#0a0a0a; }
  #root { position:fixed; inset:0; }
</style>
${styleUri ? `<link rel="stylesheet" href="${styleUri}">` : ""}
<title>Capability Pack Designer</title>
</head>
<body>
  <div id="root" data-initial='${initPayload}'></div>
  <script type="module" src="${scriptUri}"></script>
</body>
</html>`;
    }
}
exports.PackDesignerPanel = PackDesignerPanel;
//# sourceMappingURL=PackDesignerPanel.js.map