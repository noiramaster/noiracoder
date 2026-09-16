/**
 * Noira tool definitions: the tools exposed to the agent model (equivalent of
 * an MCP toolset plus built-ins). Each tool is a plain object with a name,
 * description, JSON schema for arguments, and a handler.
 */

export interface ToolDefinition<TArgs = unknown> {
  name: string;
  description: string;
  /** JSON schema parameters object (draft-07-ish) sent to the model. */
  parameters: Record<string, unknown>;
  handler: (args: TArgs, ctx: ToolCallContext) => Promise<string>;
}

export interface ToolCallContext {
  cwd: string;
  /** When false, destructive ops are refused. */
  confirmDestructive: boolean;
  /** Interactive confirm callback (safety). */
  confirm: (msg: string) => Promise<boolean>;
  /** Sensitive-path detector for policy. */
  isSensitive?: (path: string) => boolean;
  log: import("../core/logger.js").Logger;
}

export type SchemaType = "string" | "number" | "boolean" | "object" | "array" | "null";

/** Builds a JSON-schema-ish parameters object from a simple shape map. */
export function params(
  shape: Record<string, { type: SchemaType; description?: string }>
): Record<string, unknown> {
  const properties: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(shape)) {
    properties[k] = { type: v.type, description: v.description ?? "" };
  }
  return { type: "object", properties, required: Object.keys(shape) };
}
