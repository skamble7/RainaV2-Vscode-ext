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

            try {
                switch (type) {
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
                    // NEW
                    case "workspace:get": {
                        const { id } = payload ?? {};
                        const data = await RainaWorkspaceService.get(id);
                        reply(true, data);
                        break;
                    }
                    // NEW
                    case "discovery:start": {
                        const { workspaceId, options } = payload ?? {};
                        const data = await RainaWorkspaceService.startDiscovery(workspaceId, options);
                        reply(true, data);
                        break;
                    }

                    default:
                        reply(false, undefined, `Unhandled message type: ${type}`);
                }
            } catch (e: any) {
                reply(false, undefined, e?.message ?? "Unknown error");
            }
        });
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

        const scriptFile: string = entry.file;              // e.g. "assets/index-abc123.js"
        const cssFile: string | undefined = entry.css?.[0]; // e.g. "assets/index-abc123.css"

        const scriptUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this.extensionUri, "media", "raina-ui", scriptFile)
        );
        const styleUri = cssFile
            ? webview.asWebviewUri(
                vscode.Uri.joinPath(this.extensionUri, "media", "raina-ui", cssFile)
            )
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
