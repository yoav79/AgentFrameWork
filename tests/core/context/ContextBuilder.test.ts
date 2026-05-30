import { describe, it, expect } from 'vitest';
import { ContextBuilder } from '../../../core/context/ContextBuilder';
import { State } from '../../../core/state/State';

describe('ContextBuilder', () => {
  it('should generate context from empty state', () => {
    const builder = new ContextBuilder();
    const state: State = { messageCount: 0 };
    const context = builder.build(state);
    
    expect(context).toEqual({
      lastUserMessage: undefined,
      projectId: undefined,
      sessionId: undefined,
      messageCount: 0,
      lastEventId: undefined,
      updatedAt: undefined,
      history: undefined
    });
  });

  it('should include last message, projectId, sessionId, and messageCount', () => {
    const builder = new ContextBuilder();
    const state: State = {
      messageCount: 5,
      lastUserMessage: 'test',
      projectId: 'proj-1',
      sessionId: 'sess-1'
    };
    const context = builder.build(state);
    
    expect(context.lastUserMessage).toBe('test');
    expect(context.projectId).toBe('proj-1');
    expect(context.sessionId).toBe('sess-1');
    expect(context.messageCount).toBe(5);
  });

  it('should include history if provided', () => {
    const builder = new ContextBuilder();
    const state: State = { messageCount: 0 };
    const history = {
      recentUserMessages: ['msg1'],
      recentActions: [],
      recentPolicyRejections: [],
      eventCount: 1
    };
    const context = builder.build(state, history);
    
    expect(context.history).toBeDefined();
    expect(context.history?.recentUserMessages).toContain('msg1');
  });
});
