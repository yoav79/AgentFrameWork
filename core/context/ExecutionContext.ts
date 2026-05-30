export interface ExecutionContextOptions {
  input: string;
  projectId?: string;
  sessionId?: string;
  metadata?: Record<string, unknown>;
}

export interface ExecutionContext {
  readonly input: string;
  readonly projectId?: string;
  readonly sessionId?: string;
  readonly metadata?: Record<string, unknown>;
}
