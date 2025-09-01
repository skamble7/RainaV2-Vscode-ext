import * as vscode from "vscode";

export class DrawioPanel {
  static open(title: string, xml: string): vscode.WebviewPanel;
  static open(context: vscode.ExtensionContext, title: string, xml: string): vscode.WebviewPanel;
  static open(a: vscode.ExtensionContext | string, b?: string, c?: string) {
    const title = typeof a === "string" ? a : String(b ?? "Draw.io");
    const xml = typeof a === "string" ? String(b ?? "") : String(c ?? "");

    const panel = vscode.window.createWebviewPanel(
      "rainaDrawio",
      title || "Draw.io",
      vscode.ViewColumn.Active,
      { enableScripts: true, retainContextWhenHidden: true }
    );

    panel.webview.html = this.getHtml(panel.webview, xml);

    panel.webview.onDidReceiveMessage((msg) => {
      switch (msg?.type) {
        case "drawio.saved": {
          const updatedXml = String(msg.xml ?? "");
          vscode.window.showInformationMessage("Draw.io diagram exported.");
          // TODO: forward updatedXml back to main webview if you want to persist it.
          break;
        }
        case "drawio.debug":
          console.log("[DrawioPanel]", msg.kind, msg.data);
          break;
        case "drawio.requestClose":
          panel.dispose();
          break;
      }
    });

    return panel;
  }

  private static getHtml(webview: vscode.Webview, xml: string) {
    const hasMx = typeof xml === "string" && /<mxfile[\s>]/i.test(xml);
    const MIN_XML = `<mxfile modified="${new Date().toISOString()}" agent="raina" version="20.6.3">
  <diagram name="Page-1"><mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/></root></mxGraphModel></diagram>
</mxfile>`;
    const xmlForLoad = hasMx ? xml : MIN_XML;

    // Base64 for transport; decode in webview with TextDecoder (UTF-8 safe)
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
    function postToEmbed(message) { editor.contentWindow.postMessage(JSON.stringify(message), "*"); }
    function dbg(kind, data) { try { vscode.postMessage({ type: "drawio.debug", kind, data }); } catch {} }

    // UTF-8 base64 decode
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

    // --- Normalization helpers ---
    function ensureGeometryAsAttribute(doc) {
      const geoms = doc.getElementsByTagName("mxGeometry");
      for (let i = 0; i < geoms.length; i++) {
        if (!geoms[i].getAttribute("as")) geoms[i].setAttribute("as", "geometry");
      }
    }

    // Ensure root has:
    //   <mxCell id="0"/>
    //   <mxCell id="1" parent="0"/>
    // and reparent any cells under 0 to 1 (layer).
    function ensureRootAndLayer(doc) {
      const model = doc.getElementsByTagName("mxGraphModel")[0];
      if (!model) return;
      const root = model.getElementsByTagName("root")[0];
      if (!root) return;

      const byId = new Map();
      for (let i = 0; i < root.childNodes.length; i++) {
        const n = root.childNodes[i];
        if (n.nodeType === 1 && n.nodeName === "mxCell") {
          const el = n;
          const id = el.getAttribute("id");
          if (id) byId.set(id, el);
        }
      }

      // id="0"
      let zero = byId.get("0");
      if (!zero) {
        zero = doc.createElement("mxCell");
        zero.setAttribute("id", "0");
        root.insertBefore(zero, root.firstChild);
      } else {
        zero.removeAttribute("parent");
        zero.removeAttribute("vertex");
        zero.removeAttribute("edge");
        zero.removeAttribute("style");
        zero.removeAttribute("value");
        // remove any geometry on id=0
        const g = zero.getElementsByTagName("mxGeometry")[0];
        if (g && g.parentNode) g.parentNode.removeChild(g);
      }

      // id="1" layer
      let layer = byId.get("1");
      if (!layer) {
        layer = doc.createElement("mxCell");
        layer.setAttribute("id", "1");
        layer.setAttribute("parent", "0");
        root.insertBefore(layer, zero.nextSibling);
      } else {
        layer.setAttribute("parent", "0");
        layer.removeAttribute("vertex");
        layer.removeAttribute("edge");
        layer.removeAttribute("style");
        layer.removeAttribute("value");
        // remove any geometry on layer
        const gs = layer.getElementsByTagName("mxGeometry");
        for (let i = gs.length - 1; i >= 0; i--) gs[i].parentNode?.removeChild(gs[i]);
        // make sure the order is 0 then 1 at top
        if (layer.previousSibling !== zero) {
          root.removeChild(layer);
          root.insertBefore(layer, zero.nextSibling);
        }
      }

      // Reparent any non-[0,1] cells that (wrongly) have parent="0" or missing parent
      for (let i = 0; i < root.childNodes.length; i++) {
        const n = root.childNodes[i];
        if (n.nodeType !== 1 || n.nodeName !== "mxCell") continue;
        const el = n;
        const id = el.getAttribute("id");
        if (id === "0" || id === "1") continue;
        const p = el.getAttribute("parent");
        if (!p || p === "0") el.setAttribute("parent", "1");
      }
    }

    function normalizeXml(xml) {
      try {
        const doc = new DOMParser().parseFromString(xml, "text/xml");
        if (doc.getElementsByTagName("parsererror").length) {
          const err = doc.getElementsByTagName("parsererror")[0]?.textContent || "unknown";
          dbg("parsererror", err);
          return xml; // fall back
        }
        ensureGeometryAsAttribute(doc);
        ensureRootAndLayer(doc);
        const out = new XMLSerializer().serializeToString(doc);
        return out;
      } catch (e) {
        dbg("normalize_error", String(e));
        return xml;
      }
    }

    const RAW_XML = b64ToUtf8("${xmlB64}");
    const XML_TEXT = normalizeXml(RAW_XML);
    dbg("xml_lengths", { raw: RAW_XML.length, normalized: XML_TEXT.length });

    let loadedOnce = false;

    window.addEventListener("message", (event) => {
      try {
        const data = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
        if (!data || !data.event) return;

        if ((data.event === "init" || data.event === "ready") && !loadedOnce) {
          loadedOnce = true;
          setTimeout(() => {
            dbg("loading_xml", { len: XML_TEXT.length });
            postToEmbed({ action: "load", xml: XML_TEXT });
          }, 0);
        }

        if (data.event === "save") postToEmbed({ action: "export", format: "xml" });
        if (data.event === "export" && data.data) vscode.postMessage({ type: "drawio.saved", xml: data.data });
        if (data.event === "exit") vscode.postMessage({ type: "drawio.requestClose" });
      } catch (e) {
        dbg("parse_error", String(e));
      }
    });

    editor.addEventListener("load", () => {
      setTimeout(() => postToEmbed({ action: "status" }), 1000);
    });
  </script>
</body>
</html>`;
  }
}
