import { describe, it, expect } from 'vitest';
import { PromptBuilder } from '../../../core/context/PromptBuilder';
import { BuiltContext } from '../../../core/context/ContextBuilder';

describe('PromptBuilder', () => {
  it('should generate instructions demanding JSON based on context', () => {
    const builder = new PromptBuilder();
    const context: BuiltContext = {
      messageCount: 1,
      lastUserMessage: 'hello',
      projectId: 'p-1',
      sessionId: 's-1'
    };
    
    const prompt = builder.build(context);
    
    expect(prompt).toContain('hello');
    expect(prompt).toContain('p-1');
    expect(prompt).toContain('s-1');
    expect(prompt).toContain('valid JSON object');
    expect(prompt).toContain('interface Decision');
    expect(prompt).not.toContain('Recent Memory:');
  });

  it('should include Recent Memory section if history exists', () => {
    const builder = new PromptBuilder();
    const context: BuiltContext = {
      messageCount: 2,
      lastUserMessage: 'hello again',
      history: {
        recentUserMessages: ['hello'],
        recentActions: [
          { actionType: 'send_message', success: true, message: 'hi' },
          { actionType: 'do_magic', success: false, error: 'fail' }
        ],
        recentPolicyRejections: [
          { reason: 'blocked', actionType: 'format' }
        ],
        eventCount: 4
      }
    };
    
    const prompt = builder.build(context);
    
    expect(prompt).toContain('Recent Memory:');
    expect(prompt).toContain('- [User] Message: "hello"');
    expect(prompt).toContain('- [System] Action Executed (send_message): Success - hi');
    expect(prompt).toContain('- [System] Action Failed (do_magic): fail');
    expect(prompt).toContain('- [System] Policy Rejected: Action "format" blocked (blocked)');
    expect(prompt).toContain('Last User Message:');
    expect(prompt.indexOf('Recent Memory:')).toBeLessThan(prompt.indexOf('Last User Message:'));
  });
});
