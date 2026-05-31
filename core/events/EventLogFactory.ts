import { EventLog } from './EventLog';
import { InMemoryEventLog } from './InMemoryEventLog';
import { FileEventLog } from './FileEventLog';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import { WorkspaceNameValidator } from '../workspace/WorkspaceNameValidator';

export interface EventLogFactoryOptions {
  persist?: boolean;
  projectId?: string;
  baseDir?: string;
  sessionId?: string;
}

export class EventLogFactory {
  public static create(options: EventLogFactoryOptions = {}): EventLog {
    if (!options.persist) {
      return new InMemoryEventLog();
    }

    const baseDir = options.baseDir || path.join(os.homedir(), '.agentframework');
    
    if (options.projectId) {
      const safeProjectId = WorkspaceNameValidator.validate(options.projectId);
      const safeSessionId = options.sessionId 
        ? WorkspaceNameValidator.validate(options.sessionId) 
        : 'default';
        
      const sessionsDir = path.join(baseDir, 'projects', safeProjectId, 'sessions');
      const sessionFilePath = path.join(sessionsDir, `${safeSessionId}.json`);
      const legacyFilePath = path.join(baseDir, 'projects', safeProjectId, 'events.json');

      // Migration from legacy events.json to sessions/default.json
      if (safeSessionId === 'default' && fs.existsSync(legacyFilePath) && !fs.existsSync(sessionFilePath)) {
        if (!fs.existsSync(sessionsDir)) {
          fs.mkdirSync(sessionsDir, { recursive: true });
        }
        try {
          fs.renameSync(legacyFilePath, sessionFilePath);
        } catch (err) {
          // If rename fails, copy and delete
          try {
            fs.copyFileSync(legacyFilePath, sessionFilePath);
            fs.unlinkSync(legacyFilePath);
          } catch (copyErr) {
            // ignore
          }
        }
      }

      return new FileEventLog(sessionFilePath);
    }

    return new FileEventLog(path.join(baseDir, 'global', 'events.json'));
  }
}
