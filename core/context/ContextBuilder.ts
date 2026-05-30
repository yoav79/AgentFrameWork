import { State } from '../state/State';

export interface BuiltContext {
  lastUserMessage?: string;
  projectId?: string;
  sessionId?: string;
  messageCount: number;
  lastEventId?: string;
  updatedAt?: Date;
}

export class ContextBuilder {
  public build(state: State): BuiltContext {
    return {
      lastUserMessage: state.lastUserMessage,
      projectId: state.projectId,
      sessionId: state.sessionId,
      messageCount: state.messageCount,
      lastEventId: state.lastEventId,
      updatedAt: state.updatedAt
    };
  }
}
