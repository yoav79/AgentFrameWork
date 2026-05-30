import { describe, it, expect } from 'vitest';
import { EventSource, EventType, InMemoryEventLog } from '../../../core/events';

describe('events/index', () => {
  it('should export all essential event modules', () => {
    expect(EventSource).toBeDefined();
    expect(EventType).toBeDefined();
    expect(InMemoryEventLog).toBeDefined();
  });
});
