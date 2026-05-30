import { describe, it, expect, vi } from 'vitest';
import { OpenAIAdapter } from '../../../core/llm/OpenAIAdapter';
import { FrameworkError } from '../../../core/errors/FrameworkError';

describe('OpenAIAdapter', () => {
  it('should call the fake client with model and mapped messages and return content', async () => {
    const mockCreate = vi.fn().mockResolvedValue({
      output_text: 'Hello from mock LLM',
      usage: {
        prompt_tokens: 10,
        completion_tokens: 5,
        total_tokens: 15
      }
    });

    const fakeClient = {
      responses: {
        create: mockCreate
      }
    };

    const adapter = new OpenAIAdapter({
      model: 'gpt-4o',
      client: fakeClient
    });

    const result = await adapter.generate({
      messages: [
        { role: 'system', content: 'You are an agent' },
        { role: 'user', content: 'Say hello' }
      ],
      temperature: 0.7,
      maxTokens: 100
    });

    expect(mockCreate).toHaveBeenCalledTimes(1);
    const calledParams = mockCreate.mock.calls[0][0];
    
    expect(calledParams.model).toBe('gpt-4o');
    expect(calledParams.input).toEqual([
      { role: 'system', content: 'You are an agent' },
      { role: 'user', content: 'Say hello' }
    ]);
    expect(calledParams.temperature).toBe(0.7);
    expect(calledParams.max_tokens).toBe(100);

    expect(result.content).toBe('Hello from mock LLM');
    expect(result.usage?.inputTokens).toBe(10);
    expect(result.usage?.outputTokens).toBe(5);
    expect(result.usage?.totalTokens).toBe(15);
    expect(result.raw).toBeDefined();
  });

  it('should throw FrameworkError if tool role is used', async () => {
    const fakeClient = { responses: { create: vi.fn() } };
    const adapter = new OpenAIAdapter({ model: 'gpt-4o', client: fakeClient });

    await expect(adapter.generate({
      messages: [{ role: 'tool', content: 'tool call' }]
    })).rejects.toThrow(FrameworkError);
  });

  it('should extract content from output if output_text is missing', async () => {
    const fakeClient = {
      responses: {
        create: vi.fn().mockResolvedValue({
          output: 'Fallback output'
        })
      }
    };
    const adapter = new OpenAIAdapter({ model: 'gpt-4o', client: fakeClient });

    const result = await adapter.generate({ messages: [{ role: 'user', content: 'hi' }] });
    expect(result.content).toBe('Fallback output');
  });

  it('should throw error if response has no usable content', async () => {
    const fakeClient = {
      responses: {
        create: vi.fn().mockResolvedValue({
          output_text: '',
          output: null
        })
      }
    };
    const adapter = new OpenAIAdapter({ model: 'gpt-4o', client: fakeClient });

    await expect(adapter.generate({ messages: [{ role: 'user', content: 'hi' }] }))
      .rejects.toThrow('OpenAI response did not include usable content.');
  });
});
