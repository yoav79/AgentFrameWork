import { describe, it, expect } from 'vitest';
import { StateResolver } from '../../../core/state/StateResolver';
import { Event, EventType, EventSource, UserMessageReceivedPayload } from '../../../core/events';

describe('StateResolver', () => {
  it('should return initial state for empty list', () => {
    const resolver = new StateResolver();
    const state = resolver.resolve([]);
    expect(state).toEqual({ messageCount: 0 });
  });

  it('should resolve a single UserMessageReceived event', () => {
    const resolver = new StateResolver();
    const event: Event<UserMessageReceivedPayload> = {
      id: 'evt-1',
      type: EventType.UserMessageReceived,
      source: EventSource.USER,
      timestamp: new Date('2026-05-30T00:00:00.000Z'),
      payload: {
        message: 'hello',
        projectId: 'proj-1',
        sessionId: 'sess-1'
      }
    };

    const state = resolver.resolve([event]);
    expect(state).toEqual({
      messageCount: 1,
      lastUserMessage: 'hello',
      projectId: 'proj-1',
      sessionId: 'sess-1',
      lastEventId: 'evt-1',
      updatedAt: new Date('2026-05-30T00:00:00.000Z')
    });
  });

  it('should resolve multiple messages and keep the last message and sum counts', () => {
    const resolver = new StateResolver();
    const event1: Event<UserMessageReceivedPayload> = {
      id: 'evt-1',
      type: EventType.UserMessageReceived,
      source: EventSource.USER,
      timestamp: new Date('2026-05-30T00:00:00.000Z'),
      payload: { message: 'hello' }
    };
    const event2: Event<UserMessageReceivedPayload> = {
      id: 'evt-2',
      type: EventType.UserMessageReceived,
      source: EventSource.USER,
      timestamp: new Date('2026-05-30T00:01:00.000Z'),
      payload: { message: 'world' }
    };

    const state = resolver.resolve([event1, event2]);
    expect(state).toEqual(expect.objectContaining({
      messageCount: 2,
      lastUserMessage: 'world',
      lastEventId: 'evt-2',
      updatedAt: new Date('2026-05-30T00:01:00.000Z')
    }));
  });

  it('should preserve projectId and sessionId from the last applicable event', () => {
    const resolver = new StateResolver();
    const event1: Event<UserMessageReceivedPayload> = {
      id: 'evt-1',
      type: EventType.UserMessageReceived,
      source: EventSource.USER,
      timestamp: new Date('2026-05-30T00:00:00.000Z'),
      payload: { message: 'hello', projectId: 'p-1', sessionId: 's-1' }
    };
    const event2: Event<UserMessageReceivedPayload> = {
      id: 'evt-2',
      type: EventType.UserMessageReceived,
      source: EventSource.USER,
      timestamp: new Date('2026-05-30T00:01:00.000Z'),
      payload: { message: 'world' } // Missing proj/sess
    };

    const state = resolver.resolve([event1, event2]);
    expect(state).toEqual(expect.objectContaining({
      messageCount: 2,
      lastUserMessage: 'world',
      projectId: 'p-1', // Should be preserved from event1
      sessionId: 's-1'  // Should be preserved from event1
    }));
  });

  it('should ignore unknown events without failing but update metadata', () => {
    const resolver = new StateResolver();
    const event1: Event<UserMessageReceivedPayload> = {
      id: 'evt-1',
      type: EventType.UserMessageReceived,
      source: EventSource.USER,
      timestamp: new Date('2026-05-30T00:00:00.000Z'),
      payload: { message: 'hello' }
    };
    const unknownEvent: Event<any> = {
      id: 'evt-2',
      type: 'SomeUnknownType',
      source: EventSource.SYSTEM,
      timestamp: new Date('2026-05-30T00:02:00.000Z'),
      payload: { foo: 'bar' }
    };

    const state = resolver.resolve([event1, unknownEvent]);
    expect(state).toEqual({
      messageCount: 1,
      lastUserMessage: 'hello',
      lastEventId: 'evt-2',
      updatedAt: new Date('2026-05-30T00:02:00.000Z')
    });
  });

  it('should not mutate original events', () => {
    const resolver = new StateResolver();
    const originalEvent: Event<UserMessageReceivedPayload> = {
      id: 'evt-1',
      type: EventType.UserMessageReceived,
      source: EventSource.USER,
      timestamp: new Date('2026-05-30T00:00:00.000Z'),
      payload: { message: 'hello' }
    };
    
    // freeze object to ensure it's not mutated
    Object.freeze(originalEvent);
    Object.freeze(originalEvent.payload);

    expect(() => {
      resolver.resolve([originalEvent]);
    }).not.toThrow();
  });
});
