/**
 * Registry managing multiple named MCP servers, merging their tools
 * into the agent under namespaced names (mcp__<server>__<tool>).
 */
import { McpClient, type McpTool } from "./client.js";

export interface McpServerConfig {
  command: string;
  args?: string[];
  cwd?: string;
}

interface ServerState {
  config: McpServerConfig;
  client: McpClient;
  tools: McpTool[];
}

export class McpRegistry {
  private readonly servers = new Map<string, ServerState>();

  add(name: string, config: McpServerConfig): void {
    if (this.servers.has(name)) {
      throw new Error(`MCP server "${name}" already registered`);
    }
    this.servers.set(name, {
      config,
      client: new McpClient(config),
      tools: [],
    });
  }

  async connectAll(): Promise<void> {
    await Promise.all(
      Array.from(this.servers.values()).map(async (s) => {
        await s.client.initialize();
        s.tools = await s.client.listTools();
      }),
    );
  }

  toolsFor(name: string): McpTool[] {
    const s = this.servers.get(name);
    return s ? s.tools : [];
  }

  /**
   * Merge tools from all servers into one flat list for injection into
   * the agent. Each tool is prefixed `mcp__<server>__<tool>` so calls
   * can be routed back to the right server.
   */
  callAll(): McpTool[] {
    const merged: McpTool[] = [];
    for (const [name, s] of this.servers) {
      for (const tool of s.tools) {
        merged.push({
          ...tool,
          name: `mcp__${name}__${tool.name}`,
        });
      }
    }
    return merged;
  }

  /**
   * Route a namespaced tool name back to its server and invoke it.
   * Returns the server name and serialized tool content.
   */
  async invoke(fullName: string, args: Record<string, unknown>): Promise<{ server: string; result: string }> {
    const prefix = "mcp__";
    if (!fullName.startsWith(prefix)) {
      throw new Error(`Unnamespaced MCP tool name "${fullName}"`);
    }
    const rest = fullName.slice(prefix.length);
    const server = rest.split("__", 1)[0];
    const tool = rest.slice(server.length + 2);
    const s = this.servers.get(server);
    if (!s) {
      throw new Error(`Unknown MCP server "${server}"`);
    }
    const result = await s.client.callTool(tool, args);
    return { server, result };
  }

  close(): void {
    for (const s of this.servers.values()) {
      s.client.close();
    }
  }
}
