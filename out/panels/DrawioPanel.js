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
exports.DrawioPanel = void 0;
const vscode = __importStar(require("vscode"));
class DrawioPanel {
    static open(context, title, xml) {
        const panel = vscode.window.createWebviewPanel("rainaDrawio", title || "Draw.io", vscode.ViewColumn.Active, {
            enableScripts: true,
            retainContextWhenHidden: true,
        });
        panel.webview.html = this.getHtml(panel.webview, xml);
        panel.webview.onDidReceiveMessage((msg) => {
            switch (msg?.type) {
                case "drawio.saved": {
                    const updatedXml = String(msg.xml ?? "");
                    // TODO: send this back to your main panel or persist via service
                    vscode.window.showInformationMessage("Sequence diagram saved from Draw.io.");
                    break;
                }
                case "drawio.requestClose":
                    panel.dispose();
                    break;
            }
        });
        return panel;
    }
    static getHtml(webview, xml) {
        const xmlB64 = Buffer.from(xml || "", "utf8").toString("base64");
        // diagrams.net embed endpoint with JSON postMessage protocol
        const EMBED_URL = "https://embed.diagrams.net/?embed=1&ui=atlas&spin=1&proto=json&saveandexit=1&noexit=1";
        const csp = `
      default-src 'none';
      img-src ${webview.cspSource} https: data:;
      frame-src https://embed.diagrams.net https://app.diagrams.net;
      script-src ${webview.cspSource} 'unsafe-inline';
      style-src ${webview.cspSource} 'unsafe-inline';
      connect-src https:;
      font-src https: data:;
    `.replace(/\n/g, " ");
        return /* html */ `<!doctype html>
<html>
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="${csp}">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>Draw.io</title>
  <style>
    html, body, iframe { height: 100%; width: 100%; margin: 0; padding: 0; overflow: hidden; background: #0a0a0a; }
  </style>
</head>
<body>
  <iframe id="editor" src="${EMBED_URL}" allow="clipboard-read; clipboard-write"></iframe>
  <script>
    const vscode = acquireVsCodeApi();
    const editor = document.getElementById("editor");

    // Utility to post a JSON message to the embed
    function postToEmbed(message) {
      editor.contentWindow.postMessage(JSON.stringify(message), "*");
    }

    // Relay messages from the embed back to the extension
    window.addEventListener("message", (event) => {
      try {
        const data = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
        if (!data) return;

        if (data.event === "ready") {
          // Provide the initial XML
          postToEmbed({ action: "load", xml: atob("${xmlB64}") });
        }

        if (data.event === "save") {
          // Ask for an export; will trigger "export" with xml
          postToEmbed({ action: "export", format: "xml" });
        }

        if (data.event === "export" && data.data) {
          vscode.postMessage({ type: "drawio.saved", xml: data.data });
        }

        if (data.event === "exit") {
          vscode.postMessage({ type: "drawio.requestClose" });
        }
      } catch (e) {
        // ignore parsing errors
      }
    });
  </script>
</body>
</html>`;
    }
}
exports.DrawioPanel = DrawioPanel;
//# sourceMappingURL=DrawioPanel.js.map