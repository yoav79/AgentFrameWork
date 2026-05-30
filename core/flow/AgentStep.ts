import type { Decision } from '../schemas/Decision';

export interface AgentStep {
  id: string;
  actionType: string;
  decision?: Decision;
  startedAt: Date;
  endedAt?: Date;
  success?: boolean;
  error?: string;
}
