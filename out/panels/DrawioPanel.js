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
    static open(a, b, c) {
        const title = typeof a === "string" ? a : String(b ?? "Draw.io");
        const xml = typeof a === "string" ? String(b ?? "") : String(c ?? "");
        const panel = vscode.window.createWebviewPanel("rainaDrawio", title || "Draw.io", vscode.ViewColumn.Active, { enableScripts: true, retainContextWhenHidden: true });
        panel.webview.html = this.getHtml(panel.webview, xml);
        panel.webview.onDidReceiveMessage((msg) => {
            switch (msg?.type) {
                case "drawio.saved": {
                    const updatedXml = String(msg.xml ?? "");
                    vscode.window.showInformationMessage("Draw.io diagram exported.");
                    // TODO: If you want to persist back to your artifact, post this to the main panel here.
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
        const hasMx = typeof xml === "string" && /<mxfile[\s>]/i.test(xml);
        const MIN_XML = `<mxfile modified="${new Date().toISOString()}" agent="raina" version="20.6.3">
  <diagram name="Page-1"><mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/></root></mxGraphModel></diagram>
</mxfile>`;
        const xmlForLoad = hasMx ? xml : MIN_XML;
        // Base64 for transport; decode in webview with TextDecoder (UTF-8 safe)
        const xmlB64 = Buffer.from(xmlForLoad, "utf8").toString("base64");
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

    function postToEmbed(message) {
      editor.contentWindow.postMessage(JSON.stringify(message), "*");
    }
    function dbg(kind, data) { try { vscode.postMessage({ type: "drawio.debug", kind, data }); } catch {} }

    // Robust UTF-8 base64 decode
    function b64ToUtf8(b64) {
      try {
        const bin = atob(b64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        return new TextDecoder("utf-8").decode(bytes);
      } catch (e) {
        try { return atob(b64); } catch { return ""; }
      }
    }

    // Normalize XML for Draw.io JSON codec:
    //  - Ensure <mxGeometry ...> has as="geometry" (missing 'as' triggers "Could not add object mxGeometry")
    function normalizeXml(xml) {
      // add as="geometry" on self-closing <mxGeometry .../>
      xml = xml.replace(/<mxGeometry\\b([^>]*?)\\/\\s*>/g, (m, attrs) => {
        if (/\\bas\\s*=/.test(attrs)) return m;
        return '<mxGeometry' + attrs + ' as="geometry"/>';
      });
      // add as="geometry" on normal <mxGeometry ...>
      xml = xml.replace(/<mxGeometry\\b([^>]*?)>/g, (m, attrs) => {
        if (/\\bas\\s*=/.test(attrs)) return m;
        return '<mxGeometry' + attrs + ' as="geometry">';
      });
      return xml;
    }

    const RAW_XML = b64ToUtf8("${xmlB64}");
    const XML_TEXT = normalizeXml(RAW_XML);

    let loadedOnce = false;

    // Relay messages from the embed back to the extension / handle lifecycle
    window.addEventListener("message", (event) => {
      try {
        const data = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
        if (!data) return;

        if ((data.event === "init" || data.event === "ready") && !loadedOnce) {
          loadedOnce = true;
          setTimeout(() => {
            dbg("loading_xml", { len: XML_TEXT.length });
            postToEmbed({ action: "load", xml: XML_TEXT });
          }, 0);
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

    // Nudge the iframe
    editor.addEventListener("load", () => {
      setTimeout(() => postToEmbed({ action: "status" }), 1000);
    });
  </script>
</body>
</html>`;
    }
}
exports.DrawioPanel = DrawioPanel;
//# sourceMappingURL=DrawioPanel.js.map