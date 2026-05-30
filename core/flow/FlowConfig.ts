export interface FlowConfig {
  maxSteps: number;
  maxToolCalls: number;
  stopOnPolicyRejection: boolean;
  stopOnToolError: boolean;
  allowRetries: boolean;
  maxRetries: number;
  stepTimeoutMs?: number;
}

export const DEFAULT_FLOW_CONFIG: FlowConfig = {
  maxSteps: 1, // Mantiene el comportamiento single-pass actual
  maxToolCalls: 1,
  stopOnPolicyRejection: true,
  stopOnToolError: true,
  allowRetries: false,
  maxRetries: 0,
};
