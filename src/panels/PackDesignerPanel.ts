import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { RainaWorkspaceService as S } from "../services/RainaWorkspaceService";

type Incoming = { type: string; token?: string; payload?: any };

export class PackDesignerPanel {
  public static currentPanel: PackDesignerPanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private readonly extensionUri: vscode.Uri;

  public static createOrShow(
    extensionUri: vscode.Uri,
    initial?: { key?: string; version?: string }
  ) {
    const column = vscode.ViewColumn.One;

    // Close previous designer tab if open
    if (PackDesignerPanel.currentPanel) {
      PackDesignerPanel.currentPanel.panel.dispose();
    }

    const panel = vscode.window.createWebviewPanel(
      "packDesigner",
      initial?.key ? `Edit Pack ${initial.key}@${initial.version}` : "New Capability Pack",
      column,
      {
        enableScripts: true,
        localResourceRoots: [vscode.Uri.joinPath(extensionUri, "media", "raina-ui")],
        retainContextWhenHidden: true,
      }
    );

    PackDesignerPanel.currentPanel = new PackDesignerPanel(panel, extensionUri, initial);
  }

  private constructor(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    initial?: { key?: string; version?: string }
  ) {
    this.panel = panel;
    this.extensionUri = extensionUri;

    this.panel.webview.html = this.getHtmlForWebview(panel.webview, initial);
    this.setMessageListener();
    this.panel.onDidDispose(() => (PackDesignerPanel.currentPanel = undefined));
  }

  private postReply(token: string | undefined, ok: boolean, data?: any, error?: string) {
    if (!token) return; // host.ts only resolves when token matches
    this.panel.webview.postMessage({ token, ok, data, error });
  }

  private async routeToService(type: string, payload: any) {
    // ---- Workspaces ----
    if (type === "workspace:list") return await S.list();
    if (type === "workspace:create") return await S.create(payload);
    if (type === "workspace:get") return await S.get(payload.id);
    if (type === "workspace:update") return await S.update(payload.id, payload.patch);

    // ---- Artifacts ----
    if (type === "artifact:get") return await S.getArtifact(payload.workspaceId, payload.artifactId);
    if (type === "artifact:head") return await S.headArtifact(payload.workspaceId, payload.artifactId);
    if (type === "artifact:patch")
      return await S.patchArtifact(payload.workspaceId, payload.artifactId, payload.etag, payload.patch, payload.provenance);
    if (type === "artifact:replace")
      return await S.replaceArtifact(payload.workspaceId, payload.artifactId, payload.etag, payload.dataPayload, payload.provenance);
    if (type === "artifact:delete") return await S.deleteArtifact(payload.workspaceId, payload.artifactId);
    if (type === "artifact:history") return await S.history(payload.workspaceId, payload.artifactId);

    // ---- Runs ----
    if (type === "runs:list") return await S.listRuns(payload.workspaceId, payload);
    if (type === "runs:get") return await S.getRun(payload.runId);
    if (type === "runs:delete") return await S.deleteRun(payload.runId);
    if (type === "runs:start") return await S.startDiscovery(payload.workspaceId, payload.requestBody);

    // ---- Baseline ----
    if (type === "baseline:set")
      return await S.setBaselineInputs(payload.workspaceId, payload.inputs, {
        ifAbsentOnly: payload.ifAbsentOnly,
        expectedVersion: payload.expectedVersion,
      });
    if (type === "baseline:patch")
      return await S.patchBaselineInputs(payload.workspaceId, {
        avc: payload.avc,
        pss: payload.pss,
        fss_stories_upsert: payload.fssStoriesUpsert,
        expectedVersion: payload.expectedVersion,
      });

    /* ================= Capability Registry ================= */

    // Capabilities (global)
    if (type === "capability:list") return await S.capabilityListAll(payload ?? {});
    if (type === "capability:get") return await S.capabilityGet(payload.id);
    if (type === "capability:create") return await S.capabilityCreate(payload);
    if (type === "capability:update") return await S.capabilityUpdate(payload.id, payload.patch);
    if (type === "capability:delete") return await S.capabilityDelete(payload.id);

    // Packs
    if (type === "capability:pack:list") return await S.capabilityPacksList(payload ?? {});
    if (type === "capability:pack:get") return await S.capabilityPackGet(payload.key, payload.version);
    if (type === "capability:pack:create") return await S.capabilityPackCreate(payload);
    if (type === "capability:pack:update") return await S.capabilityPackUpdate(payload.key, payload.version, payload.patch);
    if (type === "capability:pack:delete") return await S.capabilityPackDelete(payload.key, payload.version);
    if (type === "capability:pack:setCaps")
      return await S.capabilityPackSetCapabilities(payload.key, payload.version, payload.capability_ids);
    if (type === "capability:pack:addPlaybook")
      return await S.capabilityPackAddPlaybook(payload.key, payload.version, payload.playbook);
    if (type === "capability:pack:removePlaybook")
      return await S.capabilityPackRemovePlaybook(payload.key, payload.version, payload.playbook_id);
    if (type === "capability:pack:reorderSteps")
      return await S.capabilityPackReorderSteps(payload.key, payload.version, payload.playbook_id, payload.order);

    // ---- Registry kinds / categories ----
    if (type === "registry:kinds:list") return await S.registryKindsList(payload?.limit, payload?.offset);
    if (type === "registry:kind:get") return await S.registryKindGet(payload.key);
    if (type === "categories:byKeys") return await S.categoriesByKeys(payload.keys ?? []);

    // Unknown → let caller know
    throw new Error(`Unhandled message type: ${type}`);
  }

  private setMessageListener() {
    this.panel.webview.onDidReceiveMessage(async (message: Incoming) => {
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
      } catch (err: any) {
        const msg = err?.message || String(err);
        // eslint-disable-next-line no-console
        console.warn("[PackDesignerPanel] Host error for", type, msg);
        this.postReply(token, false, undefined, msg);
      }
    });
  }

  private getHtmlForWebview(webview: vscode.Webview, initial?: { key?: string; version?: string }): string {
    const manifestPath = path.join(this.extensionUri.fsPath, "media", "raina-ui", "manifest.json");
    if (!fs.existsSync(manifestPath)) {
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
