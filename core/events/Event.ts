import { EventType } from './EventType';
import { EventSource } from './EventSource';

export interface UserMessageReceivedPayload {
  message: string;
  projectId?: string;
  sessionId?: string;
}

export interface PolicyRejectedPayload {
  reason: string;
  severity?: string;
  actionType?: string;
  confidence?: number;
  runId?: string;
  stepId?: string;
  sessionId?: string;
  projectId?: string;
}

export interface ActionExecutedPayload {
  actionType: string;
  success: boolean;
  message?: string;
  runId?: string;
  stepId?: string;
  sessionId?: string;
  projectId?: string;
}

export interface ActionFailedPayload {
  actionType: string;
  error: string;
  runId?: string;
  stepId?: string;
  sessionId?: string;
  projectId?: string;
}

export interface Event<TPayload = unknown> {
  id: string;
  type: EventType | string;
  source: EventSource | string;
  timestamp: Date;
  payload: TPayload;
}
