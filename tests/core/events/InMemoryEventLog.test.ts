import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryEventLog } from '../../../core/events/InMemoryEventLog';
import { EventSource } from '../../../core/events/EventSource';
import { EventType } from '../../../core/events/EventType';
import { Event } from '../../../core/events/Event';
import { FrameworkError } from '../../../core/errors/FrameworkError';

describe('InMemoryEventLog', () => {
  let eventLog: InMemoryEventLog;

  beforeEach(() => {
    eventLog = new InMemoryEventLog();
  });

  it('should initialize empty', () => {
    expect(eventLog.getAll()).toEqual([]);
  });

  it('should allow appending a valid event', () => {
    const validEvent: Event<{ message: string }> = {
      id: '1',
      type: EventType.UserMessageReceived,
      source: EventSource.USER,
      timestamp: new Date(),
      payload: { message: 'hello' }
    };

    eventLog.append(validEvent);
    expect(eventLog.getAll()).toHaveLength(1);
    expect(eventLog.getAll()[0]).toEqual(validEvent);
  });

  it('should retrieve events in insertion order', () => {
    const event1: Event<unknown> = { id: '1', type: 't', source: 's', timestamp: new Date(), payload: {} };
    const event2: Event<unknown> = { id: '2', type: 't', source: 's', timestamp: new Date(), payload: {} };
    
    eventLog.append(event1);
    eventLog.append(event2);

    const all = eventLog.getAll();
    expect(all[0].id).toBe('1');
    expect(all[1].id).toBe('2');
  });

  it('should not expose the internal mutable array reference via getAll', () => {
    const validEvent: Event<unknown> = { id: '1', type: 't', source: 's', timestamp: new Date(), payload: {} };
    eventLog.append(validEvent);

    const all = eventLog.getAll();
    all.push({ id: 'mutated', type: 't', source: 's', timestamp: new Date(), payload: {} });

    expect(eventLog.getAll()).toHaveLength(1);
    expect(eventLog.getAll()[0].id).toBe('1');
  });

  it('should reject event without id', () => {
    const invalid = { type: 't', source: 's', timestamp: new Date(), payload: {} } as Event<unknown>;
    expect(() => eventLog.append(invalid)).toThrowError(FrameworkError);
    expect(() => eventLog.append(invalid)).toThrowError('Event must have an id');
  });

  it('should reject event without type', () => {
    const invalid = { id: '1', source: 's', timestamp: new Date(), payload: {} } as Event<unknown>;
    expect(() => eventLog.append(invalid)).toThrowError(FrameworkError);
    expect(() => eventLog.append(invalid)).toThrowError('Event must have a type');
  });

  it('should reject event without source', () => {
    const invalid = { id: '1', type: 't', timestamp: new Date(), payload: {} } as Event<unknown>;
    expect(() => eventLog.append(invalid)).toThrowError(FrameworkError);
    expect(() => eventLog.append(invalid)).toThrowError('Event must have a source');
  });

  it('should reject event without timestamp', () => {
    const invalid = { id: '1', type: 't', source: 's', payload: {} } as Event<unknown>;
    expect(() => eventLog.append(invalid)).toThrowError(FrameworkError);
    expect(() => eventLog.append(invalid)).toThrowError('Event must have a timestamp');
  });

  it('should reject event with undefined payload', () => {
    const invalid = { id: '1', type: 't', source: 's', timestamp: new Date() } as Event<unknown>;
    expect(() => eventLog.append(invalid)).toThrowError(FrameworkError);
    expect(() => eventLog.append(invalid)).toThrowError('Event must have a payload');
  });
});
