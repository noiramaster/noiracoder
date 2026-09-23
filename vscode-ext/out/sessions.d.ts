import * as vscode from "vscode";
import { MotorClient } from "./motor";
interface FileChange {
    type: "created" | "changed" | "deleted";
    path: string;
    time: Date;
}
export declare class SessionsProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
    private _onDidChangeTreeData;
    readonly onDidChangeTreeData: vscode.Event<vscode.TreeItem | undefined>;
    private motor;
    private fileChanges;
    private maxChanges;
    constructor(motor: MotorClient);
    refresh(): void;
    addFileChange(type: FileChange["type"], path: string): void;
    getTreeItem(element: vscode.TreeItem): vscode.TreeItem;
    getChildren(element?: vscode.TreeItem): Promise<vscode.TreeItem[]>;
}
export {};
//# sourceMappingURL=sessions.d.ts.map