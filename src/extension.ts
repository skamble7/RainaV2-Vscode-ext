// src/extension.ts
import * as vscode from "vscode";
import { RainaPanel } from "./panels/RainaPanel";

// Change this to "close" if you prefer hiding the entire Side Bar after launch.
const DISMISS_MODE: "explorer" | "close" = "explorer";

export function activate(context: vscode.ExtensionContext) {
  // 1) Command used by palette and by the Activity Bar launcher
  const openCmd = vscode.commands.registerCommand("raina.open", () => {
    RainaPanel.createOrShow(context.extensionUri);
  });
  context.subscriptions.push(openCmd);

  // 2) Minimal TreeDataProvider backing the Activity Bar view (empty view)
  //    Must match package.json > contributes.views.raina[0].id ("rainaLauncher")
  const provider = new (class implements vscode.TreeDataProvider<vscode.TreeItem> {
    onDidChangeTreeData?: vscode.Event<void | vscode.TreeItem | null | undefined> | undefined;
    getTreeItem(element: vscode.TreeItem) { return element; }
    getChildren() { return []; }
  })();

  const view = vscode.window.createTreeView("rainaLauncher", { treeDataProvider: provider });
  context.subscriptions.push(view);

  // 3) Auto-run command when the view becomes visible, then dismiss the Side Bar
  let launchedThisVisibility = false;

  const launchAndDismiss = async () => {
    await vscode.commands.executeCommand("raina.open");

    if (DISMISS_MODE === "close") {
      // Hide the entire Side Bar
      await vscode.commands.executeCommand("workbench.action.closeSidebar");
    } else {
      // Switch back to Explorer so the user stays in their usual layout
      await vscode.commands.executeCommand("workbench.view.explorer");
    }
  };

  const maybeLaunch = () => {
    if (view.visible && !launchedThisVisibility) {
      launchedThisVisibility = true;
      void launchAndDismiss();
    }
  };

  // If VS Code restored the view already visible on startup
  if (view.visible) {
    maybeLaunch();
  }

  // When the user clicks the Activity Bar icon
  const visSub = view.onDidChangeVisibility(e => {
    if (e.visible) {
      maybeLaunch();
    } else {
      launchedThisVisibility = false; // allow relaunch next time it’s shown
    }
  });
  context.subscriptions.push(visSub);
}

export function deactivate() {}
