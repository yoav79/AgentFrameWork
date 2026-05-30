import { EventLog } from './EventLog';
import { InMemoryEventLog } from './InMemoryEventLog';
import { FileEventLog } from './FileEventLog';
import * as os from 'os';
import * as path from 'path';
import { WorkspaceNameValidator } from '../workspace/WorkspaceNameValidator';

export interface EventLogFactoryOptions {
  persist?: boolean;
  projectId?: string;
  baseDir?: string;
}

export class EventLogFactory {
  public static create(options: EventLogFactoryOptions = {}): EventLog {
    if (!options.persist) {
      return new InMemoryEventLog();
    }

    const baseDir = options.baseDir || path.join(os.homedir(), '.agentframework');
    
    if (options.projectId) {
      const safeProjectId = WorkspaceNameValidator.validate(options.projectId);
      return new FileEventLog(path.join(baseDir, 'projects', safeProjectId, 'events.json'));
    }

    return new FileEventLog(path.join(baseDir, 'global', 'events.json'));
  }
}
