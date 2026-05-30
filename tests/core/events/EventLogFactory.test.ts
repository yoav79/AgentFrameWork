import { describe, it, expect } from 'vitest';
import { EventLogFactory } from '../../../core/events/EventLogFactory';
import { InMemoryEventLog } from '../../../core/events/InMemoryEventLog';
import { FileEventLog } from '../../../core/events/FileEventLog';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';

describe('EventLogFactory', () => {
  it('should return InMemoryEventLog if persist is false or missing', () => {
    const log1 = EventLogFactory.create();
    expect(log1).toBeInstanceOf(InMemoryEventLog);

    const log2 = EventLogFactory.create({ persist: false });
    expect(log2).toBeInstanceOf(InMemoryEventLog);
  });

  it('should return FileEventLog with global path if persist is true and no projectId', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'eventlogfactory-test-'));
    const log = EventLogFactory.create({ persist: true, baseDir: tempDir });
    expect(log).toBeInstanceOf(FileEventLog);
    // test the path is created
    expect(fs.existsSync(path.join(tempDir, 'global', 'events.json'))).toBe(true);
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('should return FileEventLog with sanitized project path if persist is true and projectId is given', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'eventlogfactory-test-'));
    // passing a nasty projectId to test sanitization
    const log = EventLogFactory.create({ persist: true, baseDir: tempDir, projectId: '../../etc/passwd' });
    expect(log).toBeInstanceOf(FileEventLog);
    
    // Should be sanitized to ______etc_passwd
    expect(fs.existsSync(path.join(tempDir, 'projects', '______etc_passwd', 'events.json'))).toBe(true);
    fs.rmSync(tempDir, { recursive: true, force: true });
  });
});
