import { EventLog } from './EventLog';
import { InMemoryEventLog } from './InMemoryEventLog';
import { FileEventLog } from './FileEventLog';
import * as os from 'os';
import * as path from 'path';

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
      const safeProjectId = this.sanitize(options.projectId);
      return new FileEventLog(path.join(baseDir, 'projects', safeProjectId, 'events.json'));
    }

    return new FileEventLog(path.join(baseDir, 'global', 'events.json'));
  }

  private static sanitize(input: string): string {
    // Replace any character that is not alphanumeric, hyphen, or underscore with an underscore
    // This prevents path traversal vulnerabilities like ../ or absolute paths
    return input.replace(/[^a-zA-Z0-9_-]/g, '_');
  }
}
