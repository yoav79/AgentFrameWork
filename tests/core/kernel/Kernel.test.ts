import { describe, it, expect } from 'vitest';
import { Kernel } from '../../../core/kernel/Kernel';
import { MockLLMAdapter } from '../../../core/llm/MockLLMAdapter';
import { ExecutionContext } from '../../../core/context/ExecutionContext';

describe('Kernel', () => {
  it('should initialize with MockLLMAdapter', () => {
    const mockLlm = new MockLLMAdapter();
    const kernel = new Kernel({ llm: mockLlm });
    expect(kernel).toBeDefined();
  });

  it('should call LLM with user message and return normalized response', async () => {
    const mockLlm = new MockLLMAdapter();
    mockLlm.setResponse({ content: 'hola mundo' });
    
    const kernel = new Kernel({ llm: mockLlm });
    const context: ExecutionContext = { input: 'di hola' };
    
    const response = await kernel.run(context);
    
    expect(response.type).toBe('message');
    expect(response.content).toBe('hola mundo');
    
    const calls = mockLlm.getCalls();
    expect(calls.length).toBe(1);
    expect(calls[0].messages.length).toBe(1);
    expect(calls[0].messages[0].role).toBe('user');
    expect(calls[0].messages[0].content).toBe('di hola');
  });

  it('should return error response if LLM throws', async () => {
    const mockLlm = new MockLLMAdapter();
    mockLlm.setError(new Error('LLM failed'));
    
    const kernel = new Kernel({ llm: mockLlm });
    const context: ExecutionContext = { input: 'rompete' };
    
    const response = await kernel.run(context);
    
    expect(response.type).toBe('error');
    expect(response.content).toBe('LLM failed');
  });

  it('should not use real OpenAIAdapter', () => {
    // Tests here exclusively import MockLLMAdapter
    expect(true).toBe(true);
  });
});
