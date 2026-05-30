export type LLMRole = "system" | "user" | "assistant" | "tool";

export interface LLMMessage {
  role: LLMRole;
  content: string;
  name?: string;
  metadata?: Record<string, unknown>;
}

export interface LLMUsage {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
}

export interface LLMGenerateInput {
  messages: LLMMessage[];
  temperature?: number;
  maxTokens?: number;
  metadata?: Record<string, unknown>;
}

export interface LLMGenerateResult {
  content: string;
  usage?: LLMUsage;
  raw?: unknown;
  metadata?: Record<string, unknown>;
}

export interface LLMAdapter {
  generate(input: LLMGenerateInput): Promise<LLMGenerateResult>;
}
