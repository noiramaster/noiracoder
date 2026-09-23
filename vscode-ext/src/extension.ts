import * as vscode from "vscode";
import { MotorClient } from "./motor";
import { SessionsProvider } from "./sessions";

let motor: MotorClient | undefined;
let sessionsProvider: SessionsProvider | undefined;

export function activate(ctx: vscode.ExtensionContext) {
  const config = vscode.workspace.getConfiguration("noiracoder");
  const port = config.get<number>("port", 3800);
  const token = config.get<string>("token", "");

  motor = new MotorClient(port, token);

  // Sidebar: Sessions tree
  sessionsProvider = new SessionsProvider(motor);
  vscode.window.registerTreeDataProvider("noiracoder.sessions", sessionsProvider);

  // Commands
  ctx.subscriptions.push(
    vscode.commands.registerCommand("noiracoder.start", async () => {
      const ok = await motor!.health();
      if (ok) {
        vscode.window.showInformationMessage("NoiraCoder motor connected");
      } else {
        vscode.window.showErrorMessage("Cannot connect to motor on port " + port);
      }
    }),
    vscode.commands.registerCommand("noiracoder.sessions", () => {
      sessionsProvider?.refresh();
    }),
    vscode.commands.registerCommand("noiracoder.ask", async () => {
      const question = await vscode.window.showInputBox({ prompt: "Ask NoiraCoder" });
      if (!question) return;

      const editor = vscode.window.activeTextEditor;
      const selection = editor?.document.getText(editor.selection);
      const msg = selection ? `${question}\n\nSelected code:\n\`\`\`\n${selection}\n\`\`\`` : question;

      const session = await motor!.newSession();
      if (!session) {
        vscode.window.showErrorMessage("Failed to create session");
        return;
      }

      await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: "NoiraCoder thinking..." },
        async () => {
          const result = await motor!.turn(msg, session);
          if (result) {
            const doc = await vscode.workspace.openTextDocument({ content: result, language: "markdown" });
            await vscode.window.showTextDocument(doc, { viewColumn: vscode.ViewColumn.Beside });
          }
        }
      );
    })
  );

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
  if (config.get<boolean>("autoStart")) {
    vscode.commands.executeCommand("noiracoder.start");
  }
}

export function deactivate() {
  motor?.close();
}
