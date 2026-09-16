/**
 * Minimal stdio MCP (Model Context Protocol) client.
 *
 * MCP over stdio uses newline-delimited JSON-RPC 2.0 messages:
 * the server writes one JSON object per line to stdout and reads
 * JSON objects from our stdin. Unlike LSP there is NO Content-Length
 * framing.
 */
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";

export interface McpTool {
  name: string;
  description: string;
  inputSchema: any;
}

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: number;
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: number;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

interface McpServerConfigInput {
  command: string;
  args?: string[];
  cwd?: string;
}

interface ContentItem {
  type?: string;
  text?: string;
  name?: string;
  url?: string;
}

interface CallToolResult {
  content?: ContentItem[] | string;
  isError?: boolean;
}

export interface McpClientOptions {
  timeoutMs?: number;
  stderr?: (line: string) => void;
}

const DEFAULT_TIMEOUT = 30_000;

export class McpClient {
  private readonly proc: ChildProcessWithoutNullStreams;
  private buf = "";
  private requestId = 0;
  private readonly pending = new Map<number, {
    resolve: (res: JsonRpcResponse) => void;
    reject: (err: Error) => void;
    timer: NodeJS.Timeout;
  }>();
  private settled: { result: unknown } | { error: Error } | null = null;
  private readonly timeoutMs: number;
  private readonly onStderr: ((line: string) => void) | undefined;

  constructor(config: McpServerConfigInput, options: McpClientOptions = {}) {
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT;
    this.onStderr = options.stderr;
    this.proc = spawn(config.command, config.args ?? [], {
      cwd: config.cwd,
      stdio: ["pipe", "pipe", "pipe"],
      shell: false,
    });
    this.proc.stdout.setEncoding("utf8");
    this.proc.stdout.on("data", (chunk: string) => this.onData(chunk));
    if (this.onStderr) {
      this.proc.stderr.setEncoding("utf8");
      this.proc.stderr.on("data", (chunk: string) => {
        for (const line of chunk.split(/\r?\n/)) {
          if (line.trim()) this.onStderr!(line);
        }
      });
    } else {
      this.proc.stderr.resume();
    }
    this.proc.on("error", (err) => this.onExit(err));
    this.proc.on("exit", (_code, _signal) => this.onExit(null));
  }

  private onExit(err: Error | null): void {
    const message = err
      ? `MCP process error: ${err.message}`
      : "MCP process exited unexpectedly";
    const exitErr = new Error(message);
    this.rejectAll(exitErr);
    if (!this.settled && err) this.settled = { error: exitErr };
  }

  private rejectAll(err: Error): void {
    for (const { reject, timer } of this.pending.values()) {
      clearTimeout(timer);
      reject(err);
    }
    this.pending.clear();
  }

  private onData(chunk: string): void {
    this.buf += chunk;
    let idx: number;
    while ((idx = this.buf.indexOf("\n")) !== -1) {
      const line = this.buf.slice(0, idx).trim();
      this.buf = this.buf.slice(idx + 1);
      if (!line) continue;
      this.handleLine(line);
    }
  }

  private handleLine(line: string): void {
    let msg: JsonRpcResponse;
    try {
      msg = JSON.parse(line) as JsonRpcResponse;
    } catch {
      // Non-JSON output from the server process; ignore it.
      return;
    }
    if (msg.id === undefined || msg.id === null) return;
    const entry = this.pending.get(msg.id);
    if (!entry) return;
    this.pending.delete(msg.id);
    clearTimeout(entry.timer);
    entry.resolve(msg);
  }

  private request<T>(method: string, params?: Record<string, unknown>): Promise<T> {
    if (this.settled && "error" in this.settled) {
      return Promise.reject(this.settled.error);
    }
    const id = ++this.requestId;
    const req: JsonRpcRequest = { jsonrpc: "2.0", id, method, params };
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`MCP request "${method}" timed out after ${this.timeoutMs}ms`));
      }, this.timeoutMs);
      this.pending.set(id, {
        resolve: (res: JsonRpcResponse) => {
          if (res.error) {
            reject(new Error(`MCP error ${res.error.code}: ${res.error.message}`));
            return;
          }
          resolve(res.result as T);
        },
        reject,
        timer,
      });
      this.writeMsg(req);
    });
  }

  async initialize(): Promise<void> {
    await this.request("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "noiracoder", version: "0.1.0" },
    });
    this.writeNotification("notifications/initialized");
  }

  private writeNotification(method: string, params?: Record<string, unknown>): void {
    this.writeMsg({ jsonrpc: "2.0", method, params });
  }

  private writeMsg(msg: unknown): void {
    if (this.proc.stdin.destroyed) {
      this.rejectAll(new Error("MCP process stdin closed"));
      throw new Error("MCP process stdin closed");
    }
    this.proc.stdin.write(JSON.stringify(msg) + "\n");
  }

  async listTools(): Promise<McpTool[]> {
    const result = (await this.request("tools/list")) as { tools?: McpTool[] };
    if (!result || !Array.isArray(result.tools)) return [];
    return result.tools.map((t) => ({
      name: String(t.name ?? ""),
      description: String(t.description ?? ""),
      inputSchema: t.inputSchema ?? {},
    }));
  }

  async callTool(name: string, args: Record<string, unknown> = {}): Promise<string> {
    const result = (await this.request("tools/call", { name, arguments: args })) as CallToolResult;
    return serializeContent(result);
  }

  close(): void {
    this.rejectAll(new Error("MCP client closed"));
    if (!this.proc.killed) {
      this.proc.kill();
    }
  }
}

function serializeContent(result: CallToolResult): string {
  const content = result?.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((item) => {
        const it = item as ContentItem;
        if (typeof it === "string") return it;
        if (it && typeof it.text === "string" && it.text) return it.text;
        if (it && typeof it === "object") {
          try {
            return JSON.stringify(it, null, 2);
          } catch {
            return String(it);
          }
        }
        return String(it);
      })
      .filter(Boolean)
      .join("\n");
  }
  try {
    return JSON.stringify(result ?? {}, null, 2);
  } catch {
    return String(result);
  }
}
