// src/panels/RainaPanel.ts
import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { RainaWorkspaceService } from "../services/RainaWorkspaceService";

export class RainaPanel {
  public static currentPanel: RainaPanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private readonly extensionUri: vscode.Uri;

  public static createOrShow(extensionUri: vscode.Uri) {
    const column = vscode.ViewColumn.One;

    if (RainaPanel.currentPanel) {
      RainaPanel.currentPanel.panel.reveal(column);
      return;
    }

    const panel = vscode.window.createWebviewPanel("raina", "Raina", column, {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(extensionUri, "media", "raina-ui")],
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

      // Dynamic access so this file compiles before we add new service methods.
      const svc = RainaWorkspaceService as any;
      const ensure = (fn: string) => {
        if (typeof svc[fn] !== "function") {
          throw new Error(
            `Backend method '${fn}' is not implemented yet. (Add it in src/services/RainaWorkspaceService.ts)`
          );
        }
        return svc[fn].bind(RainaWorkspaceService);
      };

      try {
        switch (type) {
          // ---- Workspace ----
          case "workspace:list": {
            const data = await RainaWorkspaceService.list();
            reply(true, data);
            break;
          }
          case "workspace:create": {
            const data = await RainaWorkspaceService.create(payload);
            reply(true, data);
            break;
          }
          case "workspace:get": {
            const { id } = payload ?? {};
            const data = await RainaWorkspaceService.get(id);
            reply(true, data);
            break;
          }
          case "workspace:update": {
            const { id, patch } = payload ?? {};
            const data = await RainaWorkspaceService.update(id, patch);
            reply(true, data);
            break;
          }

          // ---- Runs (NEW) ----
          case "runs:list": {
            const { workspaceId, limit, offset } = payload ?? {};
            const listRuns = ensure("listRuns");
            const data = await listRuns(workspaceId, { limit, offset });
            reply(true, data);
            break;
          }
          case "runs:get": {
            const { runId } = payload ?? {};
            const getRun = ensure("getRun");
            const data = await getRun(runId);
            reply(true, data);
            break;
          }
          case "runs:delete": {
            const { runId } = payload ?? {};
            const deleteRun = ensure("deleteRun");
            await deleteRun(runId);
            reply(true, { ok: true });
            break;
          }
          case "runs:start": {
            // Reuse your existing discovery start service method
            const { workspaceId, requestBody } = payload ?? {};
            const data = await RainaWorkspaceService.startDiscovery(workspaceId, requestBody);
            reply(true, data);
            break;
          }

          // ---- Discovery (existing) ----
          case "discovery:start": {
            const { workspaceId, options } = payload ?? {};
            const data = await RainaWorkspaceService.startDiscovery(workspaceId, options);
            reply(true, data);
            break;
          }

          // ---- Artifacts (ETag-aware) ----
          case "artifact:get": {
            const { workspaceId, artifactId } = payload ?? {};
            const out = await RainaWorkspaceService.getArtifact(workspaceId, artifactId);
            reply(true, out);
            break;
          }
          case "artifact:head": {
            const { workspaceId, artifactId } = payload ?? {};
            const etag = await RainaWorkspaceService.headArtifact(workspaceId, artifactId);
            reply(true, { etag });
            break;
          }
          case "artifact:patch": {
            const { workspaceId, artifactId, etag, patch, provenance } = payload ?? {};
            const out = await RainaWorkspaceService.patchArtifact(
              workspaceId,
              artifactId,
              etag,
              patch,
              provenance
            );
            reply(true, out);
            break;
          }
          case "artifact:replace": {
            const { workspaceId, artifactId, etag, dataPayload, provenance } = payload ?? {};
            const out = await RainaWorkspaceService.replaceArtifact(
              workspaceId,
              artifactId,
              etag,
              dataPayload,
              provenance
            );
            reply(true, out);
            break;
          }
          case "artifact:delete": {
            const { workspaceId, artifactId } = payload ?? {};
            await RainaWorkspaceService.deleteArtifact(workspaceId, artifactId);
            reply(true, { ok: true });
            break;
          }
          case "artifact:history": {
            const { workspaceId, artifactId } = payload ?? {};
            const data = await RainaWorkspaceService.history(workspaceId, artifactId);
            reply(true, data);
            break;
          }

          // ---- Draw.io panel ----
          case "raina.openDrawio": {
            const { title, xml } = payload ?? {};
            this.openDrawioPanel(title || "Sequence Diagram", String(xml ?? ""));
            // No reply needed; this is a fire-and-forget action
            break;
          }

          // ---- Misc / dev pings ----
          case "hello": {
            reply(true, { ok: true });
            break;
          }

          default:
            reply(false, undefined, `Unhandled message type: ${type}`);
        }
      } catch (e: any) {
        const msg = e?.message ?? String(e) ?? "Unknown error";
        reply(false, undefined, msg);
      }
    });
  }

  // Opens a new VS Code tab with diagrams.net embedded and round-trips XML back here.
  private openDrawioPanel(title: string, xml: string) {
    const panel = vscode.window.createWebviewPanel("rainaDrawio", title, vscode.ViewColumn.Active, {
      enableScripts: true,
      retainContextWhenHidden: true,
    });

    panel.webview.html = this.getDrawioHtml(panel.webview, xml);

    // Forward saves back to the main webview so UI can persist to artifact-service
    panel.webview.onDidReceiveMessage((msg) => {
      if (msg?.type === "drawio.saved") {
        const updatedXml = String(msg.xml ?? "");
        // Forward to main webview; UI can decide how to persist
        this.panel.webview.postMessage({
          type: "drawio.saved",
          payload: { title, xml: updatedXml },
        });
        vscode.window.showInformationMessage("Draw.io diagram exported.");
      } else if (msg?.type === "drawio.requestClose") {
        panel.dispose();
      }
    });
  }

  private getDrawioHtml(webview: vscode.Webview, xml: string) {
    const hasMx = typeof xml === "string" && /<mxfile[\s>]/i.test(xml);
    const MIN_XML = `<mxfile modified="${new Date().toISOString()}" agent="raina" version="20.6.3">
  <diagram name="Page-1"><mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/></root></mxGraphModel></diagram>
</mxfile>`;
    const xmlForLoad = hasMx ? xml : MIN_XML;
    const xmlB64 = Buffer.from(xmlForLoad, "utf8").toString("base64");

    const EMBED_URL =
      "https://embed.diagrams.net/?embed=1&ui=atlas&spin=1&proto=json&saveandexit=1&noexit=1";

    const csp = `
    default-src 'none';
    img-src ${webview.cspSource} https: data:;
    frame-src https://embed.diagrams.net https://app.diagrams.net;
    script-src ${webview.cspSource} 'unsafe-inline';
    style-src ${webview.cspSource} 'unsafe-inline';
    connect-src https:;
    font-src https: data:;
  `.replace(/\n/g, " ");

    return `<!doctype html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="${csp}">
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Draw.io</title>
  <style>html,body,iframe{height:100%;width:100%;margin:0;padding:0;overflow:hidden;background:#0a0a0a}</style>
</head>
<body>
  <iframe id="editor" src="${EMBED_URL}" allow="clipboard-read; clipboard-write"></iframe>
  <script>
    const vscode = acquireVsCodeApi();
    const editor = document.getElementById("editor");

    function postToEmbed(message) {
      editor.contentWindow.postMessage(JSON.stringify(message), "*");
    }

    // For visibility when debugging
    function dbg(kind, data) {
      vscode.postMessage({ type: "drawio.debug", kind, data });
    }

    // Some builds send 'init', some send 'ready' — handle both
    window.addEventListener("message", (event) => {
      try {
        const data = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
        if (!data || !data.event) return;

        if (data.event === "init" || data.event === "ready") {
          // Stop spinner by loading valid XML
          postToEmbed({ action: "load", xml: atob("${xmlB64}") });
          dbg("loaded", { len: ${xmlForLoad.length} });
        }

        if (data.event === "save") {
          postToEmbed({ action: "export", format: "xml" });
        }

        if (data.event === "export" && data.data) {
          vscode.postMessage({ type: "drawio.saved", xml: data.data });
        }

        if (data.event === "exit") {
          vscode.postMessage({ type: "drawio.requestClose" });
        }
      } catch (e) {
        dbg("parse_error", String(e));
      }
    });

    // Optional nudge in case 'init' never arrives (rare)
    editor.addEventListener("load", () => {
      setTimeout(() => postToEmbed({ action: "status" }), 1500);
    });
  </script>
</body>
</html>`;
  }

  private getHtmlForWebview(webview: vscode.Webview): string {
    // 1) Try Vite-internal path (.vite/manifest.json), 2) fallback to manifest.json at root
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

    // Some manifests key by "index.html", others by entry like "src/main.tsx"
    const entryKey = manifest["index.html"] ? "index.html" : Object.keys(manifest)[0];
    const entry = manifest[entryKey];

    const scriptFile: string = entry.file; // e.g. "assets/index-abc123.js"
    const cssFile: string | undefined = entry.css?.[0]; // e.g. "assets/index-abc123.css"

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
  /* VS Code webviews sometimes add body padding (20px). Kill it. */
  body { margin:0 !important; padding:0 !important; background:#0a0a0a; }
  #root { position:fixed; inset:0; } /* full-bleed root */
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
