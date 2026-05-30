export interface ToolResult {
  success: boolean;
  message?: string;
  data?: Record<string, unknown>;
  error?: string;
}
