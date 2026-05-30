import { describe, it, expect } from 'vitest';
import * as Context from '../../../core/context';

describe('core/context index', () => {
  it('should export ExecutionContextOptions, ExecutionContext, ContextFactory', () => {
    expect(Context.ContextFactory).toBeDefined();
    const ctx = Context.ContextFactory.create({ input: 'test' });
    expect(ctx.input).toBe('test');
  });
});
