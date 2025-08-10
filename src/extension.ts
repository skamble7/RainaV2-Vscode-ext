// src/extension.ts
import * as vscode from "vscode";
import { RainaPanel } from "./panels/RainaPanel";

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand("raina.open", () => RainaPanel.createOrShow(context.extensionUri))
  );
}

export function deactivate() {}
