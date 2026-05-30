import { describe, it, expect } from 'vitest';
import { AgentFactory } from '../../../core/agent/AgentFactory';
import { LLMAdapter } from '../../../core/llm/LLMAdapter';

class MockLLMAdapter implements LLMAdapter {
  constructor(public responseContent: string) {}
  async generate() {
    return { content: this.responseContent };
  }
}

describe('AgentFactory', () => {
  it('should create an AgentKernel instance', () => {
    const llmAdapter = new MockLLMAdapter('{}');
    const kernel = AgentFactory.create(llmAdapter);
    expect(kernel).toBeDefined();
    expect(typeof kernel.run).toBe('function');
  });

  it('should successfully register SendMessageSkill and execute a simple flow', async () => {
    const validJson = JSON.stringify({
      intent: 'respond',
      confidence: 1,
      proposedAction: { type: 'send_message', payload: { message: 'hello from factory' } }
    });
    const llmAdapter = new MockLLMAdapter(validJson);
    const kernel = AgentFactory.create(llmAdapter);

    const result = await kernel.run({ input: 'test' });
    expect(result.success).toBe(true);
    expect(result.result?.message).toBe('hello from factory');
  });
});
