import { State } from '../state/State';
import { HistoryContext } from '../memory/HistoryContext';

export interface BuiltContext {
  lastUserMessage?: string;
  projectId?: string;
  sessionId?: string;
  messageCount: number;
  lastEventId?: string;
  updatedAt?: Date;
  history?: HistoryContext;
}

export class ContextBuilder {
  public build(state: State, history?: HistoryContext): BuiltContext {
    return {
      lastUserMessage: state.lastUserMessage,
      projectId: state.projectId,
      sessionId: state.sessionId,
      messageCount: state.messageCount,
      lastEventId: state.lastEventId,
      updatedAt: state.updatedAt,
      history
    };
  }
}
