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
    expect(history.recentActions).toHaveLength(2);
    expect(history.recentActions[0]).toEqual({ actionType: 'send_message', success: true, message: 'hi there' });
    expect(history.recentActions[1]).toEqual({ actionType: 'do_magic', success: false, error: 'not found' });
    expect(history.recentPolicyRejections).toHaveLength(1);
    expect(history.recentPolicyRejections[0]).toEqual({ reason: 'low confidence', actionType: 'unknown_action', confidence: 0.1 });
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

    expect(history.recentUserMessages[0].length).toBe(503); // 500 + '...'
    expect(history.recentUserMessages[0].endsWith('...')).toBe(true);
  });
});
