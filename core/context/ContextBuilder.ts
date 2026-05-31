import { State } from '../state/State';
import { HistoryContext } from '../memory/HistoryContext';
import { WorkingMemoryEntry } from '../memory/WorkingMemoryEntry';

export interface EphemeralStepContext {
  actionType: string;
  message?: string;
  data?: unknown;
}

export interface BuiltContext {
  lastUserMessage?: string;
  projectId?: string;
  sessionId?: string;
  messageCount: number;
  lastEventId?: string;
  updatedAt?: Date;
  history?: HistoryContext;
  ephemeralStepContext?: EphemeralStepContext;
  workingMemory?: WorkingMemoryEntry[];
}

export class ContextBuilder {
  public build(state: State, history?: HistoryContext, ephemeralStepContext?: EphemeralStepContext): BuiltContext {
    return {
      lastUserMessage: state.lastUserMessage,
      projectId: state.projectId,
      sessionId: state.sessionId,
      messageCount: state.messageCount,
      lastEventId: state.lastEventId,
      updatedAt: state.updatedAt,
      history,
      ephemeralStepContext,
      workingMemory: state.workingMemory
    };
  }
}
