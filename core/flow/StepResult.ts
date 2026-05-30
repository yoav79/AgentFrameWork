import type { AgentStep } from './AgentStep';

export interface StepResult {
  step: AgentStep;
  success: boolean;
  message?: string;
  error?: string;
  data?: unknown;
}
