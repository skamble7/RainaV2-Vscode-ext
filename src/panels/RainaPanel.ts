// src/panels/RainaPanel.ts
import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { RainaWorkspaceService } from "../services/RainaWorkspaceService";
import { DrawioPanel } from "./DrawioPanel";

export class RainaPanel {
  public static currentPanel: RainaPanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private readonly extensionUri: vscode.Uri;

  public static postToWebview(message: unknown) {
    const p = RainaPanel.currentPanel?.panel;
    if (p) p.webview.postMessage(message);
  }

  public static createOrShow(extensionUri: vscode.Uri) {
    const column = vscode.ViewColumn.One;
    if (RainaPanel.currentPanel) {
      RainaPanel.currentPanel.panel.reveal(column);
      return;
    }
    const panel = vscode.window.createWebviewPanel("raina", "Raina", column, {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(extensionUri, "media", "raina-ui")],
      retainContextWhenHidden: true,
    });
    RainaPanel.currentPanel = new RainaPanel(panel, extensionUri);
  }

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    this.panel = panel;
    this.extensionUri = extensionUri;
    this.panel.webview.html = this.getHtmlForWebview(panel.webview);
    this.setMessageListener();
    this.panel.onDidDispose(() => (RainaPanel.currentPanel = undefined));
  }

  private setMessageListener() {
    this.panel.webview.onDidReceiveMessage(async (message) => {
      const { type, token, payload } = message ?? {};
      const reply = (ok: boolean, data?: any, error?: string) =>
        this.panel.webview.postMessage({ token, ok, data, error });

      const svc = RainaWorkspaceService as any;
      const ensure = (fn: string) => {
        if (typeof svc[fn] !== "function") {
          throw new Error(`Backend method '${fn}' is not implemented yet. (Add it in src/services/RainaWorkspaceService.ts)`);
        }
        return svc[fn].bind(RainaWorkspaceService);
      };

      try {
        switch (type) {
          
          case "packDesigner:open": {
            const { key, version } = payload ?? {};
            const { PackDesignerPanel } = require("./PackDesignerPanel");
            PackDesignerPanel.createOrShow(this.extensionUri, { key, version });
            reply(true, { ok: true });
            break;
          }

          // ---------- Artifact Categories ----------
          case "categories:byKeys": {
            const { keys = [] } = payload ?? {};
            const fn = ensure("categoriesByKeys");
            const data = await fn(keys);
            reply(true, data);
            break;
          }

          // ---------- Capability: Global ----------
          case "capability:list": {
            const { q, tag, limit = 100, offset = 0 } = payload ?? {};
            const list = ensure("capabilityListAll");
            const data = await list({ q, tag, limit, offset });
            reply(true, data);
            break;
          }
          case "capability:get": {
            const { id } = payload ?? {};
            const get = ensure("capabilityGet");
            const data = await get(id);
            reply(true, data);
            break;
          }
          case "capability:create": {
            const body = payload ?? {};
            const create = ensure("capabilityCreate");
            const data = await create(body);
            reply(true, data);
            break;
          }
          case "capability:update": {
            const { id, patch } = payload ?? {};
            const update = ensure("capabilityUpdate");
            const data = await update(id, patch);
            reply(true, data);
            break;
          }
          case "capability:delete": {
            const { id } = payload ?? {};
            const del = ensure("capabilityDelete");
            await del(id);
            reply(true, { ok: true });
            break;
          }

          // ---------- Capability Packs ----------
          case "capability:pack:get": {
            const { key, version } = payload ?? {};
            const getPack = ensure("capabilityPackGet");
            const data = await getPack(key, version);
            reply(true, data);
            break;
          }
          case "capability:pack:list": {
            const { key, q, limit = 50, offset = 0 } = payload ?? {};
            const listPacks = ensure("capabilityPacksList");
            const data = await listPacks({ key, q, limit, offset });
            reply(true, data);
            break;
          }
          case "capability:pack:create": {
            const body = payload ?? {};
            const createPack = ensure("capabilityPackCreate");
            const data = await createPack(body);
            reply(true, data);
            break;
          }
          case "capability:pack:update": {
            const { key, version, patch } = payload ?? {};
            const updatePack = ensure("capabilityPackUpdate");
            const data = await updatePack(key, version, patch);
            reply(true, data);
            break;
          }
          case "capability:pack:delete": {
            const { key, version } = payload ?? {};
            const deletePack = ensure("capabilityPackDelete");
            await deletePack(key, version);
            reply(true, { ok: true });
            break;
          }
          case "capability:pack:setCaps": {
            const { key, version, capability_ids } = payload ?? {};
            const setCaps = ensure("capabilityPackSetCapabilities");
            const data = await setCaps(key, version, capability_ids);
            reply(true, data);
            break;
          }
          case "capability:pack:addPlaybook": {
            const { key, version, playbook } = payload ?? {};
            const addPb = ensure("capabilityPackAddPlaybook");
            const data = await addPb(key, version, playbook);
            reply(true, data);
            break;
          }
          case "capability:pack:removePlaybook": {
            const { key, version, playbook_id } = payload ?? {};
            const rmPb = ensure("capabilityPackRemovePlaybook");
            const data = await rmPb(key, version, playbook_id);
            reply(true, data);
            break;
          }
          case "capability:pack:reorderSteps": {
            const { key, version, playbook_id, order } = payload ?? {};
            const reorder = ensure("capabilityPackReorderSteps");
            const data = await reorder(key, version, playbook_id, order);
            reply(true, data);
            break;
          }

          // ---------- Registry kinds ----------
          case "registry:kinds:list": {
            const { limit = 200, offset = 0 } = payload ?? {};
            const listKinds = ensure("registryKindsList");
            const data = await listKinds(limit, offset);
            reply(true, data);
            break;
          }
          case "registry:kind:get": {
            const { key } = payload ?? {};
            const getKind = ensure("registryKindGet");
            const data = await getKind(key);
            reply(true, data);
            break;
          }

          // ---------- Existing workspace / runs / artifacts (unchanged) ----------
          case "workspace:list": { const data = await RainaWorkspaceService.list(); reply(true, data); break; }
          case "workspace:create": { const data = await RainaWorkspaceService.create(payload); reply(true, data); break; }
          case "workspace:get": { const { id } = payload ?? {}; const data = await RainaWorkspaceService.get(id); reply(true, data); break; }
          case "workspace:update": { const { id, patch } = payload ?? {}; const data = await RainaWorkspaceService.update(id, patch); reply(true, data); break; }

          case "runs:list": {
            const { workspaceId, limit, offset } = payload ?? {};
            const listRuns = ensure("listRuns");
            const data = await listRuns(workspaceId, { limit, offset });
            reply(true, data);
            break;
          }
          case "runs:get": { const { runId } = payload ?? {}; const getRun = ensure("getRun"); const data = await getRun(runId); reply(true, data); break; }
          case "runs:delete": { const { runId } = payload ?? {}; const deleteRun = ensure("deleteRun"); await deleteRun(runId); reply(true, { ok: true }); break; }
          case "runs:start": { const { workspaceId, requestBody } = payload ?? {}; const data = await RainaWorkspaceService.startDiscovery(workspaceId, requestBody); reply(true, data); break; }

          case "baseline:set": {
            const { workspaceId, inputs, ifAbsentOnly, expectedVersion } = payload ?? {};
            const setBaselineInputs = ensure("setBaselineInputs");
            const data = await setBaselineInputs(workspaceId, inputs, { ifAbsentOnly, expectedVersion });
            reply(true, data);
            break;
          }
          case "baseline:patch": {
            const { workspaceId, avc, pss, fssStoriesUpsert, expectedVersion } = payload ?? {};
            const patchBaselineInputs = ensure("patchBaselineInputs");
            const data = await patchBaselineInputs(workspaceId, {
              avc, pss, fss_stories_upsert: fssStoriesUpsert, expectedVersion,
            });
            reply(true, data);
            break;
          }

          case "artifact:get": { const { workspaceId, artifactId } = payload ?? {}; const out = await RainaWorkspaceService.getArtifact(workspaceId, artifactId); reply(true, out); break; }
          case "artifact:head": { const { workspaceId, artifactId } = payload ?? {}; const etag = await RainaWorkspaceService.headArtifact(workspaceId, artifactId); reply(true, { etag }); break; }
          case "artifact:patch": {
            const { workspaceId, artifactId, etag, patch, provenance } = payload ?? {};
            const out = await RainaWorkspaceService.patchArtifact(workspaceId, artifactId, etag, patch, provenance);
            reply(true, out);
            break;
          }
          case "artifact:replace": {
            const { workspaceId, artifactId, etag, dataPayload, provenance } = payload ?? {};
            const out = await RainaWorkspaceService.replaceArtifact(workspaceId, artifactId, etag, dataPayload, provenance);
            reply(true, out);
            break;
          }
          case "artifact:delete": { const { workspaceId, artifactId } = payload ?? {}; await RainaWorkspaceService.deleteArtifact(workspaceId, artifactId); reply(true, { ok: true }); break; }
          case "artifact:history": { const { workspaceId, artifactId } = payload ?? {}; const data = await RainaWorkspaceService.history(workspaceId, artifactId); reply(true, data); break; }

          case "raina.openDrawio": {
            const { title, xml } = payload ?? {};
            DrawioPanel.open(title || "Diagram", String(xml ?? ""));
            reply(true, { ok: true });
            break;
          }

          case "hello": { reply(true, { ok: true }); break; }

          default:
            reply(false, undefined, `Unhandled message type: ${type}`);
        }
      } catch (e: any) {
        const msg = e?.message ?? String(e) ?? "Unknown error";
        reply(false, undefined, msg);
      }
    });
  }

  private getHtmlForWebview(webview: vscode.Webview): string {
    const manifestCandidates = [
      path.join(this.extensionUri.fsPath, "media", "raina-ui", ".vite", "manifest.json"),
      path.join(this.extensionUri.fsPath, "media", "raina-ui", "manifest.json"),
    ];
    const manifestPath = manifestCandidates.find(fs.existsSync);
    if (!manifestPath) {
      vscode.window.showErrorMessage("Vite build not found. Run `npm run build` in raina-ui.");
      return "<html><body><h3>Build missing</h3></body></html>";
    }
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
    const entryKey = manifest["index.html"] ? "index.html" : Object.keys(manifest)[0];
    const entry = manifest[entryKey];
    const scriptFile: string = entry.file;
    const cssFile: string | undefined = entry.css?.[0];
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, "media", "raina-ui", scriptFile)
    );
    const styleUri = cssFile
      ? webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, "media", "raina-ui", cssFile))
      : undefined;

    return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<style>
  html, body, #root { height:100%; width:100%; }
  body { margin:0 !important; padding:0 !important; background:#0a0a0a; }
  #root { position:fixed; inset:0; }
</style>
${styleUri ? `<link rel="stylesheet" href="${styleUri}">` : ""}
<title>Raina</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="${scriptUri}"></script>
</body>
</html>`;
  }
}
