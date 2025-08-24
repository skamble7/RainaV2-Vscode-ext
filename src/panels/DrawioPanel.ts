import * as vscode from "vscode";

export class DrawioPanel {
  static open(context: vscode.ExtensionContext, title: string, xml: string) {
    const panel = vscode.window.createWebviewPanel(
      "rainaDrawio",
      title || "Draw.io",
      vscode.ViewColumn.Active,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
      }
    );

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

  private static getHtml(webview: vscode.Webview, xml: string) {
    const xmlB64 = Buffer.from(xml || "", "utf8").toString("base64");

    // diagrams.net embed endpoint with JSON postMessage protocol
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
