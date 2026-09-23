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
exports.SessionsProvider = void 0;
const vscode = __importStar(require("vscode"));
class SessionsProvider {
    constructor(motor) {
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        this.fileChanges = [];
        this.maxChanges = 50;
        this.motor = motor;
    }
    refresh() {
        this._onDidChangeTreeData.fire(undefined);
    }
    addFileChange(type, path) {
        this.fileChanges.unshift({ type, path, time: new Date() });
        if (this.fileChanges.length > this.maxChanges) {
            this.fileChanges.pop();
        }
        this.refresh();
    }
    getTreeItem(element) {
        return element;
    }
    async getChildren(element) {
        if (!element) {
            // Root: show status + file changes
            const items = [];
            // Motor status
            const status = new vscode.TreeItem("Motor Status", vscode.TreeItemCollapsibleState.None);
            const ok = await this.motor.health();
            status.iconPath = new vscode.ThemeIcon(ok ? "check" : "error");
            status.description = ok ? "Connected" : "Disconnected";
            items.push(status);
            // Sessions
            const sessionsItem = new vscode.TreeItem("Sessions", vscode.TreeItemCollapsibleState.Expanded);
            sessionsItem.iconPath = new vscode.ThemeIcon("list-flat");
            items.push(sessionsItem);
            // File changes header
            if (this.fileChanges.length > 0) {
                const changesHeader = new vscode.TreeItem(`Recent Changes (${this.fileChanges.length})`, vscode.TreeItemCollapsibleState.Expanded);
                changesHeader.iconPath = new vscode.ThemeIcon("git-commit");
                items.push(changesHeader);
            }
            return items;
        }
        // Children of root items
        if (element.label === "Sessions") {
            try {
                const sessions = await this.motor.sessions();
                if (sessions.length === 0) {
                    return [new vscode.TreeItem("No sessions")];
                }
                return sessions.slice(0, 10).map((s) => {
                    const item = new vscode.TreeItem(s.name || s.id?.slice(0, 8) || "session", vscode.TreeItemCollapsibleState.None);
                    item.description = s.id?.slice(0, 8);
                    item.iconPath = new vscode.ThemeIcon("comment-discussion");
                    return item;
                });
            }
            catch {
                return [new vscode.TreeItem("Cannot load sessions")];
            }
        }
        if (element.label?.toString().startsWith("Recent Changes")) {
            return this.fileChanges.slice(0, 20).map((c) => {
                const item = new vscode.TreeItem(c.path.split(/[/\\]/).pop() || c.path, vscode.TreeItemCollapsibleState.None);
                item.description = c.type;
                item.tooltip = `${c.type}: ${c.path}\n${c.time.toLocaleTimeString()}`;
                const icons = {
                    created: "file-add",
                    changed: "file-edit",
                    deleted: "file-minus",
                };
                item.iconPath = new vscode.ThemeIcon(icons[c.type] || "file");
                return item;
            });
        }
        return [];
    }
}
exports.SessionsProvider = SessionsProvider;
//# sourceMappingURL=sessions.js.map