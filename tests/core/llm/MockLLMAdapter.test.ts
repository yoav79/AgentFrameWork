import { describe, it, expect, beforeEach } from 'vitest';
import { MockLLMAdapter } from '../../../core/llm/MockLLMAdapter';
import { LLMGenerateInput } from '../../../core/llm/LLMAdapter';

describe('MockLLMAdapter', () => {
  let adapter: MockLLMAdapter;
  const dummyInput: LLMGenerateInput = {
    messages: [{ role: 'user', content: 'hello' }]
  };

  beforeEach(() => {
    adapter = new MockLLMAdapter();
  });

  it('should return a default response when no fixed response or queue is set', async () => {
    const response = await adapter.generate(dummyInput);
    expect(response.content).toBe('Default mock response');
    expect(adapter.getCalls()).toHaveLength(1);
    expect(adapter.getLastCall()).toEqual(dummyInput);
  });

  it('should return fixed response when set', async () => {
    const fixed = { content: 'Fixed content' };
    adapter.setResponse(fixed);
    const response = await adapter.generate(dummyInput);
    expect(response).toEqual(fixed);
  });

  it('should return responses from queue in order', async () => {
    adapter.setResponses([{ content: 'First' }, { content: 'Second' }]);
    
    const r1 = await adapter.generate(dummyInput);
    expect(r1.content).toBe('First');
    
    const r2 = await adapter.generate(dummyInput);
    expect(r2.content).toBe('Second');
    
    const r3 = await adapter.generate(dummyInput);
    expect(r3.content).toBe('Default mock response');
  });

  it('should throw an error if configured', async () => {
    const testError = new Error('Test error');
    adapter.setError(testError);
    
    await expect(adapter.generate(dummyInput)).rejects.toThrow('Test error');
    
    adapter.clearError();
    const response = await adapter.generate(dummyInput);
    expect(response.content).toBe('Default mock response');
  });

  it('should clear calls', async () => {
    await adapter.generate(dummyInput);
    expect(adapter.getCalls()).toHaveLength(1);
    
    adapter.clearCalls();
    expect(adapter.getCalls()).toHaveLength(0);
    expect(adapter.getLastCall()).toBeNull();
  });
});
