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
const vscode = __importStar(require("vscode"));
const motor_1 = require("./motor");
const sessions_1 = require("./sessions");
let motor;
let sessionsProvider;
function activate(ctx) {
    const config = vscode.workspace.getConfiguration("noiracoder");
    const port = config.get("port", 3800);
    const token = config.get("token", "");
    motor = new motor_1.MotorClient(port, token);
    // Sidebar: Sessions tree
    sessionsProvider = new sessions_1.SessionsProvider(motor);
    vscode.window.registerTreeDataProvider("noiracoder.sessions", sessionsProvider);
    // Commands
    ctx.subscriptions.push(vscode.commands.registerCommand("noiracoder.start", async () => {
        const ok = await motor.health();
        if (ok) {
            vscode.window.showInformationMessage("NoiraCoder motor connected");
        }
        else {
            vscode.window.showErrorMessage("Cannot connect to motor on port " + port);
        }
    }), vscode.commands.registerCommand("noiracoder.sessions", () => {
        sessionsProvider?.refresh();
    }), vscode.commands.registerCommand("noiracoder.ask", async () => {
        const question = await vscode.window.showInputBox({ prompt: "Ask NoiraCoder" });
        if (!question)
            return;
        const editor = vscode.window.activeTextEditor;
        const selection = editor?.document.getText(editor.selection);
        const msg = selection ? `${question}\n\nSelected code:\n\`\`\`\n${selection}\n\`\`\`` : question;
        const session = await motor.newSession();
        if (!session) {
            vscode.window.showErrorMessage("Failed to create session");
            return;
        }
        await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: "NoiraCoder thinking..." }, async () => {
            const result = await motor.turn(msg, session);
            if (result) {
                const doc = await vscode.workspace.openTextDocument({ content: result, language: "markdown" });
                await vscode.window.showTextDocument(doc, { viewColumn: vscode.ViewColumn.Beside });
            }
        });
    }));
    // File change tracker: watch for saves and log them
    const watcher = vscode.workspace.createFileSystemWatcher("**/*");
    watcher.onDidChange((uri) => {
        sessionsProvider?.addFileChange("changed", uri.fsPath);
    });
    watcher.onDidCreate((uri) => {
        sessionsProvider?.addFileChange("created", uri.fsPath);
    });
    watcher.onDidDelete((uri) => {
        sessionsProvider?.addFileChange("deleted", uri.fsPath);
    });
    ctx.subscriptions.push(watcher);
    // Auto-start if configured
    if (config.get("autoStart")) {
        vscode.commands.executeCommand("noiracoder.start");
    }
}
function deactivate() {
    motor?.close();
}
//# sourceMappingURL=extension.js.map