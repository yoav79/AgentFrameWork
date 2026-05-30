import { EventType } from './EventType';
import { EventSource } from './EventSource';

export interface UserMessageReceivedPayload {
  message: string;
  projectId?: string;
  sessionId?: string;
}

export interface Event<TPayload = unknown> {
  id: string;
  type: EventType | string;
  source: EventSource | string;
  timestamp: Date;
  payload: TPayload;
}
