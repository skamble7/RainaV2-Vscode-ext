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
// src/extension.ts
const vscode = __importStar(require("vscode"));
const RainaPanel_1 = require("./panels/RainaPanel");
// Change this to "close" if you prefer hiding the entire Side Bar after launch.
const DISMISS_MODE = "explorer";
function activate(context) {
    // 1) Command used by palette and by the Activity Bar launcher
    const openCmd = vscode.commands.registerCommand("raina.open", () => {
        RainaPanel_1.RainaPanel.createOrShow(context.extensionUri);
    });
    context.subscriptions.push(openCmd);
    // 2) Minimal TreeDataProvider backing the Activity Bar view (empty view)
    //    Must match package.json > contributes.views.raina[0].id ("rainaLauncher")
    const provider = new (class {
        onDidChangeTreeData;
        getTreeItem(element) { return element; }
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
        }
        else {
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
        }
        else {
            launchedThisVisibility = false; // allow relaunch next time it’s shown
        }
    });
    context.subscriptions.push(visSub);
}
function deactivate() { }
//# sourceMappingURL=extension.js.map