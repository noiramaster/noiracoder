/**
 * Shared types across NoiraCoder.
 */

export type Level = "low" | "medium" | "high" | "max" | "offline";

export type Role = "system" | "user" | "assistant" | "tool";

export interface ChatMessage {
  role: Role;
  content: string;
  tool_call_id?: string;
  tool_calls?: ToolCall[];
  name?: string;
}

export interface ToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

export interface ToolResult {
  tool_call_id: string;
  content: string;
  isError?: boolean;
}

export interface ModelInfo {
  id: string;
  name?: string;
  /** OpenRouter pricing in USD per token to the provider/model. */
  pricing: { prompt: string; completion: string };
  context_length: number;
  /** Category used by the router to pick "the right" model per role. */
  category?: string;
  /** True when free (max_price=0 in the OpenRouter catalog). */
  free: boolean;
  /** provider rank / name, informational. */
  provider?: string;
  /** Chat/tool capability. False for non-chat models (image/video/audio gen)
   *  that OpenRouter reports with `supported_parameters.tools = false` and
   *  cannot route tool-use through. Defaults to true. */
  tools?: boolean;
}

export interface QuotaState {
  /** requests used today for this model holder. */
  used: number;
  /** known daily free limit. */
  limit: number | null;
  /** total requests allowed if a known limit exists. */
  total: number | null;
}

export interface RouterDecision {
  model: string;
  free: boolean;
  /** Provider that owns this model id (from catalog merge). Used to pick the right client. */
  provider?: string;
}

export interface ExecOptions {
  level: Level;
  cwd: string;
  /** flags sensitive work so orchestration may add cross-checking. */
  sensitive?: boolean;
  prompt: string;
}

export interface PromptOptions {
  timeoutMs?: number;
}
