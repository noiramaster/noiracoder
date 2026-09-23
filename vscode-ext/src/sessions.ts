import * as vscode from "vscode";
import { MotorClient } from "./motor";

interface FileChange {
  type: "created" | "changed" | "deleted";
  path: string;
  time: Date;
}

export class SessionsProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<vscode.TreeItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private motor: MotorClient;
  private fileChanges: FileChange[] = [];
  private maxChanges = 50;

  constructor(motor: MotorClient) {
    this.motor = motor;
  }

  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  addFileChange(type: FileChange["type"], path: string): void {
    this.fileChanges.unshift({ type, path, time: new Date() });
    if (this.fileChanges.length > this.maxChanges) {
      this.fileChanges.pop();
    }
    this.refresh();
  }

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: vscode.TreeItem): Promise<vscode.TreeItem[]> {
    if (!element) {
      // Root: show status + file changes
      const items: vscode.TreeItem[] = [];

      // Motor status
      const status = new vscode.TreeItem("Motor Status", vscode.TreeItemCollapsibleState.None);
      const ok = await this.motor.health();
      status.iconPath = new vscode.ThemeIcon(ok ? "check" : "error");
      status.description = ok ? "Connected" : "Disconnected";
      items.push(status);

      // Sessions
      const sessionsItem = new vscode.TreeItem(
        "Sessions",
        vscode.TreeItemCollapsibleState.Expanded
      );
      sessionsItem.iconPath = new vscode.ThemeIcon("list-flat");
      items.push(sessionsItem);

      // File changes header
      if (this.fileChanges.length > 0) {
        const changesHeader = new vscode.TreeItem(
          `Recent Changes (${this.fileChanges.length})`,
          vscode.TreeItemCollapsibleState.Expanded
        );
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
        return sessions.slice(0, 10).map((s: any) => {
          const item = new vscode.TreeItem(
            s.name || s.id?.slice(0, 8) || "session",
            vscode.TreeItemCollapsibleState.None
          );
          item.description = s.id?.slice(0, 8);
          item.iconPath = new vscode.ThemeIcon("comment-discussion");
          return item;
        });
      } catch {
        return [new vscode.TreeItem("Cannot load sessions")];
      }
    }

    if (element.label?.toString().startsWith("Recent Changes")) {
      return this.fileChanges.slice(0, 20).map((c) => {
        const item = new vscode.TreeItem(
          c.path.split(/[/\\]/).pop() || c.path,
          vscode.TreeItemCollapsibleState.None
        );
        item.description = c.type;
        item.tooltip = `${c.type}: ${c.path}\n${c.time.toLocaleTimeString()}`;
        const icons: Record<string, string> = {
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
