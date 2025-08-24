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
exports.activate = activate;
exports.deactivate = deactivate;
//src/extension.ts
const vscode = __importStar(require("vscode"));
const RainaPanel_1 = require("./panels/RainaPanel");
const NotificationStream_1 = require("./services/NotificationStream");
// Change this to "close" if you prefer hiding the entire Side Bar after launch.
const DISMISS_MODE = "explorer";
let notifStream = null;
let output = null;
function activate(context) {
    // ---- Output panel + WebSocket stream -------------------------------------
    output = vscode.window.createOutputChannel("RAINA Notifications");
    context.subscriptions.push(output);
    // Start WS stream using setting (fallback to localhost)
    const cfg = vscode.workspace.getConfiguration("raina");
    const wsUrl = cfg.get("notificationWsUrl", "ws://localhost:8016/ws");
    // NEW: create the stream with onEvent to forward events to the webview
    notifStream = new NotificationStream_1.NotificationStream({
        url: wsUrl,
        channel: output,
        autoStart: true,
        onEvent: (evt) => {
            // Forward all events; UI will decide if it cares (e.g., run updates)
            RainaPanel_1.RainaPanel.postToWebview({ type: "runs:event", payload: evt });
        },
    });
    context.subscriptions.push({ dispose: () => notifStream?.dispose() });
    // React to config changes (URL)
    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration("raina.notificationWsUrl")) {
            const newUrl = vscode.workspace
                .getConfiguration("raina")
                .get("notificationWsUrl", wsUrl);
            output?.appendLine(`[RAINA] WS URL changed to ${newUrl}. Reconnecting...`);
            notifStream?.dispose();
            notifStream = new NotificationStream_1.NotificationStream({
                url: newUrl,
                channel: output,
                autoStart: true,
                onEvent: (evt) => {
                    RainaPanel_1.RainaPanel.postToWebview({ type: "runs:event", payload: evt });
                },
            });
        }
    }));
    // Command to quickly show the output panel
    context.subscriptions.push(vscode.commands.registerCommand("raina.notifications.openOutput", () => output?.show(true)));
    // ---- Your existing Activity Bar auto-launch flow --------------------------
    const openCmd = vscode.commands.registerCommand("raina.open", () => {
        RainaPanel_1.RainaPanel.createOrShow(context.extensionUri);
    });
    context.subscriptions.push(openCmd);
    // Minimal TreeDataProvider backing the Activity Bar view (empty view)
    const provider = new (class {
        onDidChangeTreeData;
        getTreeItem(element) { return element; }
        getChildren() { return []; }
    })();
    const view = vscode.window.createTreeView("rainaLauncher", { treeDataProvider: provider });
    context.subscriptions.push(view);
    let launchedThisVisibility = false;
    const launchAndDismiss = async () => {
        await vscode.commands.executeCommand("raina.open");
        if (DISMISS_MODE === "close") {
            await vscode.commands.executeCommand("workbench.action.closeSidebar");
        }
        else {
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
    const visSub = view.onDidChangeVisibility((e) => {
        if (e.visible) {
            maybeLaunch();
        }
        else {
            launchedThisVisibility = false;
        }
    });
    context.subscriptions.push(visSub);
    // Show the notifications panel on activation so users see live events
    output.show(true);
}
function deactivate() {
    notifStream?.dispose();
    notifStream = null;
    output?.dispose();
    output = null;
}
//# sourceMappingURL=extension.js.map