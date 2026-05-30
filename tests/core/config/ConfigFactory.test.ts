import { describe, it, expect } from 'vitest';
import { ConfigFactory } from '../../../core/config/ConfigFactory';

describe('ConfigFactory', () => {
  it('should create default configuration deterministically', () => {
    const config1 = ConfigFactory.createDefault();
    const config2 = ConfigFactory.createDefault();

    expect(config1).toBeDefined();
    expect(config1.llmProvider).toBe('mock');
    expect(config1).toHaveProperty('mockResponse', 'Mock LLM response');

    // Ensure createDefault does not return shared mutable state.
    expect(config1).not.toBe(config2);
    expect(config1).toEqual(config2);
  });
});
