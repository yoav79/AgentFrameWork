import { describe, it, expect } from 'vitest';
import { ContextFactory } from '../../../core/context/ContextFactory';
import { FrameworkError } from '../../../core/errors/FrameworkError';

describe('ContextFactory', () => {
  it('should create context with only input', () => {
    const ctx = ContextFactory.create({ input: 'hello' });
    expect(ctx.input).toBe('hello');
    expect(ctx.projectId).toBeUndefined();
    expect(ctx.sessionId).toBeUndefined();
    expect(ctx.metadata).toBeUndefined();
  });

  it('should create context with projectId and sessionId', () => {
    const ctx = ContextFactory.create({ input: 'hello', projectId: 'p1', sessionId: 's1' });
    expect(ctx.input).toBe('hello');
    expect(ctx.projectId).toBe('p1');
    expect(ctx.sessionId).toBe('s1');
  });

  it('should preserve metadata', () => {
    const meta = { key: 'value' };
    const ctx = ContextFactory.create({ input: 'hello', metadata: meta });
    expect(ctx.metadata).toEqual(meta);
  });

  it('should throw if options is null or array', () => {
    expect(() => ContextFactory.create(null)).toThrow(FrameworkError);
    expect(() => ContextFactory.create([])).toThrow(FrameworkError);
  });

  it('should throw if input is invalid', () => {
    expect(() => ContextFactory.create({ input: 123 })).toThrow(FrameworkError);
    expect(() => ContextFactory.create({})).toThrow(FrameworkError);
  });

  it('should throw if input is empty or only whitespace', () => {
    expect(() => ContextFactory.create({ input: '' })).toThrow(FrameworkError);
    expect(() => ContextFactory.create({ input: '   ' })).toThrow(FrameworkError);
  });

  it('should preserve valid input with lateral whitespaces', () => {
    const ctx = ContextFactory.create({ input: '  hello  ' });
    expect(ctx.input).toBe('  hello  ');
  });

  it('should throw if projectId is invalid', () => {
    expect(() => ContextFactory.create({ input: 'h', projectId: 123 })).toThrow(FrameworkError);
  });

  it('should throw if sessionId is invalid', () => {
    expect(() => ContextFactory.create({ input: 'h', sessionId: [] })).toThrow(FrameworkError);
  });

  it('should throw if metadata is invalid', () => {
    expect(() => ContextFactory.create({ input: 'h', metadata: [] })).toThrow(FrameworkError);
    expect(() => ContextFactory.create({ input: 'h', metadata: null })).toThrow(FrameworkError);
  });
});
