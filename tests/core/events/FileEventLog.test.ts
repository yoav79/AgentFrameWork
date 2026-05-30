import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FileEventLog } from '../../../core/events/FileEventLog';
import { EventType, EventSource } from '../../../core/events';
import { FrameworkError } from '../../../core/errors/FrameworkError';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('FileEventLog', () => {
  let tempDir: string;
  let filePath: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-framework-test-'));
    filePath = path.join(tempDir, 'events.json');
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('starts empty if file does not exist and creates it on init', () => {
    const log = new FileEventLog(filePath);
    expect(log.getAll()).toEqual([]);
    expect(fs.existsSync(filePath)).toBe(true);
  });

  it('persists event and recovers it with a new instance', () => {
    const log1 = new FileEventLog(filePath);
    const event = {
      id: '1',
      type: EventType.UserMessageReceived,
      source: EventSource.USER,
      timestamp: new Date('2026-05-30T10:00:00.000Z'),
      payload: { msg: 'hello' }
    };
    log1.append(event);

    const log2 = new FileEventLog(filePath);
    const recovered = log2.getAll();
    
    expect(recovered.length).toBe(1);
    expect(recovered[0].id).toBe('1');
    expect(recovered[0].timestamp).toBeInstanceOf(Date);
    expect(recovered[0].timestamp.toISOString()).toBe('2026-05-30T10:00:00.000Z');
  });

  it('maintains order of events', () => {
    const log = new FileEventLog(filePath);
    log.append({ id: '1', type: EventType.UserMessageReceived, source: EventSource.USER, timestamp: new Date(), payload: {} });
    log.append({ id: '2', type: EventType.UserMessageReceived, source: EventSource.USER, timestamp: new Date(), payload: {} });
    
    const events = log.getAll();
    expect(events[0].id).toBe('1');
    expect(events[1].id).toBe('2');
  });

  it('rejects malformed events', () => {
    const log = new FileEventLog(filePath);
    
    expect(() => log.append({} as any)).toThrow(FrameworkError);
    expect(() => log.append({ id: '1' } as any)).toThrow(FrameworkError);
    expect(() => log.append({ id: '1', type: EventType.UserMessageReceived } as any)).toThrow(FrameworkError);
  });

  it('handles corrupt JSON with controlled error', () => {
    fs.writeFileSync(filePath, '{ bad json');
    expect(() => new FileEventLog(filePath)).toThrow(FrameworkError);
    expect(() => new FileEventLog(filePath)).toThrow(/Failed to load FileEventLog/);
  });

  it('handles JSON not being an array', () => {
    fs.writeFileSync(filePath, '{"not": "array"}');
    expect(() => new FileEventLog(filePath)).toThrow(FrameworkError);
    expect(() => new FileEventLog(filePath)).toThrow(/JSON must be an array/);
  });

  it('getAll() does not expose mutable reference', () => {
    const log = new FileEventLog(filePath);
    log.append({ id: '1', type: EventType.UserMessageReceived, source: EventSource.USER, timestamp: new Date(), payload: {} });
    
    const events = log.getAll();
    events.push({ id: '2', type: EventType.UserMessageReceived, source: EventSource.USER, timestamp: new Date(), payload: {} });
    
    expect(log.getAll().length).toBe(1);
  });
});
