import { describe, it, expect } from 'vitest';
import * as LLM from '../../../core/llm';

describe('LLM Module Exports', () => {
  it('should export MockLLMAdapter and OpenAIAdapter', () => {
    expect(LLM.MockLLMAdapter).toBeDefined();
    expect(LLM.OpenAIAdapter).toBeDefined();
  });
});
