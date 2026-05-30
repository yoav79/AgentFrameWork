import { describe, it, expect } from 'vitest';
import * as Context from '../../../core/context';

describe('core/context index', () => {
  it('should export ContextBuilder and PromptBuilder', () => {
    expect(Context.ContextBuilder).toBeDefined();
    expect(Context.PromptBuilder).toBeDefined();
  });
});
