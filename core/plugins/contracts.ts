import { Tool } from '../tools/Tool';

export interface PluginContext {
  workspaceRoot: string;
  projectId?: string;
  sessionId?: string;
  config: Record<string, unknown>;
  logger: {
    info(...args: unknown[]): void;
    warn(...args: unknown[]): void;
    error(...args: unknown[]): void;
  };
}

export interface ToolPluginModule {
  manifest: {
    name: string;
    version: string;
    kind: 'tool';
    actionType: string;
    description?: string;
    isTerminal?: boolean;
    minConfidence?: number;
  };
  create: (ctx: PluginContext) => Tool;
}
