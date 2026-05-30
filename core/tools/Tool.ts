import { ToolResult } from './ToolResult';

export interface Tool {
  readonly name: string;
  readonly description: string;
  canHandle(actionType: string): boolean;
  execute(input: unknown): Promise<ToolResult> | ToolResult;
}
