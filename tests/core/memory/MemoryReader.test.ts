import { describe, it, expect } from 'vitest';
import { MemoryReader } from '../../../core/memory/MemoryReader';
import { InMemoryEventLog } from '../../../core/events/InMemoryEventLog';
import { EventType } from '../../../core/events/EventType';
import { EventSource } from '../../../core/events/EventSource';

describe('MemoryReader', () => {
  it('reads recent user messages, actions and rejections', () => {
    const log = new InMemoryEventLog();
    log.append({
      id: '1', type: EventType.UserMessageReceived, source: EventSource.USER, timestamp: new Date(),
      payload: { message: 'hello' }
    });
    log.append({
      id: '2', type: EventType.ActionExecuted, source: EventSource.SYSTEM, timestamp: new Date(),
      payload: { actionType: 'send_message', success: true, message: 'hi there' }
    });
    log.append({
      id: '3', type: EventType.ActionFailed, source: EventSource.SYSTEM, timestamp: new Date(),
      payload: { actionType: 'do_magic', error: 'not found' }
    });
    log.append({
      id: '4', type: EventType.PolicyRejected, source: EventSource.SYSTEM, timestamp: new Date(),
      payload: { reason: 'low confidence', actionType: 'unknown_action', confidence: 0.1 }
    });
    log.append({
      id: '5', type: 'UnknownEvent', source: EventSource.SYSTEM, timestamp: new Date(),
      payload: { something: 'else' }
    });

    const reader = new MemoryReader(log);
    const history = reader.read();

    expect(history.eventCount).toBe(5);
    expect(history.recentUserMessages).toEqual(['hello']);
    // Only send_message appears — do_magic is a failed action so it still appears
    expect(history.recentActions).toHaveLength(2);
    expect(history.recentActions[0]).toEqual({ actionType: 'send_message', success: true, message: 'hi there' });
    expect(history.recentActions[1]).toEqual({ actionType: 'do_magic', success: false, error: 'not found' });
    expect(history.recentPolicyRejections).toHaveLength(1);
    expect(history.recentPolicyRejections[0]).toEqual({ reason: 'low confidence', actionType: 'unknown_action', confidence: 0.1 });
  });

  it('does NOT include read_file (intermediate tool) in memory history', () => {
    const log = new InMemoryEventLog();
    log.append({
      id: '1', type: EventType.UserMessageReceived, source: EventSource.USER, timestamp: new Date(),
      payload: { message: 'lee el archivo hello.txt' }
    });
    // Step 1 of multi-step loop: read_file executed successfully
    log.append({
      id: '2', type: EventType.ActionExecuted, source: EventSource.SYSTEM, timestamp: new Date(),
      payload: { actionType: 'read_file', success: true, message: 'File read successfully' }
    });
    // Step 2: send_message executed
    log.append({
      id: '3', type: EventType.ActionExecuted, source: EventSource.SYSTEM, timestamp: new Date(),
      payload: { actionType: 'send_message', success: true, message: 'El archivo dice: hello world' }
    });

    const reader = new MemoryReader(log);
    const history = reader.read();

    // read_file must NOT appear — it would cause LLM to think task is done on next turn
    expect(history.recentActions).toHaveLength(1);
    expect(history.recentActions[0]!.actionType).toBe('send_message');
    expect(history.recentActions.find(a => a.actionType === 'read_file')).toBeUndefined();
  });

  it('respects the limit option', () => {
    const log = new InMemoryEventLog();
    for (let i = 0; i < 25; i++) {
      log.append({
        id: `${i}`, type: EventType.UserMessageReceived, source: EventSource.USER, timestamp: new Date(),
        payload: { message: `msg ${i}` }
      });
    }

    const reader = new MemoryReader(log);
    
    const h1 = reader.read();
    expect(h1.eventCount).toBe(20);
    expect(h1.recentUserMessages[0]).toBe('msg 5'); // 25 - 20 = 5

    const h2 = reader.read({ limit: 5 });
    expect(h2.eventCount).toBe(5);
    expect(h2.recentUserMessages[0]).toBe('msg 20');
  });

  it('truncates long texts', () => {
    const log = new InMemoryEventLog();
    log.append({
      id: '1', type: EventType.UserMessageReceived, source: EventSource.USER, timestamp: new Date(),
      payload: { message: 'A'.repeat(1000) }
    });

    const reader = new MemoryReader(log);
    const history = reader.read();

    expect(history.recentUserMessages[0]!.length).toBe(503); // 500 + '...'
    expect(history.recentUserMessages[0]!.endsWith('...')).toBe(true);
  });

  it('isolates memory history by sessionId and projectId', () => {
    const log = new InMemoryEventLog();
    log.append({
      id: '1', type: EventType.UserMessageReceived, source: EventSource.USER, timestamp: new Date(),
      payload: { message: 'hello session 1', sessionId: 'session-1', projectId: 'project-1' }
    });
    log.append({
      id: '2', type: EventType.UserMessageReceived, source: EventSource.USER, timestamp: new Date(),
      payload: { message: 'hello session 2', sessionId: 'session-2', projectId: 'project-1' }
    });
    log.append({
      id: '3', type: EventType.UserMessageReceived, source: EventSource.USER, timestamp: new Date(),
      payload: { message: 'hello project 2', sessionId: 'session-1', projectId: 'project-2' }
    });
    log.append({
      id: '4', type: EventType.UserMessageReceived, source: EventSource.USER, timestamp: new Date(),
      payload: { message: 'hello global (no session/project)' }
    });

    const reader = new MemoryReader(log);
    
    const h1 = reader.read({ sessionId: 'session-1', projectId: 'project-1' });
    expect(h1.recentUserMessages).toContain('hello session 1');
    expect(h1.recentUserMessages).toContain('hello global (no session/project)');
    expect(h1.recentUserMessages).not.toContain('hello session 2');
    expect(h1.recentUserMessages).not.toContain('hello project 2');

    const h2 = reader.read({ sessionId: 'session-2' });
    expect(h2.recentUserMessages).toContain('hello session 2');
    expect(h2.recentUserMessages).toContain('hello global (no session/project)');
    expect(h2.recentUserMessages).not.toContain('hello session 1');
  });
});
