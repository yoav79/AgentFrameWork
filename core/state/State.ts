import { WorkingMemoryEntry } from '../memory/WorkingMemoryEntry';

export interface State {
  lastUserMessage?: string;
  projectId?: string;
  sessionId?: string;
  messageCount: number;
  lastEventId?: string;
  updatedAt?: Date;
  workingMemory?: WorkingMemoryEntry[];
}
