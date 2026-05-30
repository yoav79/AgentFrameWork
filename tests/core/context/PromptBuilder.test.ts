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
  });
});
