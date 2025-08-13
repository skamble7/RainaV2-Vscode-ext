// src/extension.ts
import * as vscode from "vscode";
import { RainaPanel } from "./panels/RainaPanel";
import { NotificationStream } from "./services/NotificationStream";

// Change this to "close" if you prefer hiding the entire Side Bar after launch.
const DISMISS_MODE: "explorer" | "close" = "explorer";

let notifStream: NotificationStream | null = null;
let output: vscode.OutputChannel | null = null;

export function activate(context: vscode.ExtensionContext) {
  // ---- Output panel + WebSocket stream -------------------------------------
  output = vscode.window.createOutputChannel("RAINA Notifications");
  context.subscriptions.push(output);

  // Start WS stream using setting (fallback to localhost)
  const cfg = vscode.workspace.getConfiguration("raina");
  const wsUrl = cfg.get<string>("notificationWsUrl", "ws://localhost:8016/ws");

  notifStream = new NotificationStream({
    url: wsUrl,
    channel: output!,
    autoStart: true,
  });
  context.subscriptions.push({ dispose: () => notifStream?.dispose() });

  // React to config changes (URL)
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration("raina.notificationWsUrl")) {
        const newUrl = vscode.workspace.getConfiguration("raina").get<string>("notificationWsUrl", wsUrl);
        output?.appendLine(`[RAINA] WS URL changed to ${newUrl}. Reconnecting...`);
        notifStream?.dispose();
        notifStream = new NotificationStream({
          url: newUrl!,
          channel: output!,
          autoStart: true,
        });
      }
    })
  );

  // Command to quickly show the output panel
  context.subscriptions.push(
    vscode.commands.registerCommand("raina.notifications.openOutput", () => output?.show(true))
  );

  // ---- Your existing Activity Bar auto-launch flow --------------------------
  const openCmd = vscode.commands.registerCommand("raina.open", () => {
    RainaPanel.createOrShow(context.extensionUri);
  });
  context.subscriptions.push(openCmd);

  // Minimal TreeDataProvider backing the Activity Bar view (empty view)
  const provider = new (class implements vscode.TreeDataProvider<vscode.TreeItem> {
    onDidChangeTreeData?: vscode.Event<void | vscode.TreeItem | null | undefined> | undefined;
    getTreeItem(element: vscode.TreeItem) { return element; }
    getChildren() { return []; }
  })();

  const view = vscode.window.createTreeView("rainaLauncher", { treeDataProvider: provider });
  context.subscriptions.push(view);

  let launchedThisVisibility = false;

  const launchAndDismiss = async () => {
    await vscode.commands.executeCommand("raina.open");
    if (DISMISS_MODE === "close") {
      await vscode.commands.executeCommand("workbench.action.closeSidebar");
    } else {
      await vscode.commands.executeCommand("workbench.view.explorer");
    }
  };

  const maybeLaunch = () => {
    if (view.visible && !launchedThisVisibility) {
      launchedThisVisibility = true;
      void launchAndDismiss();
    }
  };

  if (view.visible) {
    maybeLaunch();
  }

  const visSub = view.onDidChangeVisibility(e => {
    if (e.visible) {
      maybeLaunch();
    } else {
      launchedThisVisibility = false;
    }
  });
  context.subscriptions.push(visSub);

  // Show the notifications panel on activation so users see live events
  output.show(true);
}

export function deactivate() {
  notifStream?.dispose();
  notifStream = null;
  output?.dispose();
  output = null;
}
