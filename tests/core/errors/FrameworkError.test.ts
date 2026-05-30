import { describe, it, expect } from 'vitest';
import { FrameworkError } from '../../../core/errors/FrameworkError';

describe('FrameworkError', () => {
  it('should instantiate with code and message', () => {
    const err = new FrameworkError('INTERNAL_ERROR', 'Something went wrong');
    expect(err.code).toBe('INTERNAL_ERROR');
    expect(err.message).toBe('Something went wrong');
  });

  it('should be an instance of Error and FrameworkError', () => {
    const err = new FrameworkError('NOT_IMPLEMENTED', 'Stub');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(FrameworkError);
  });

  it('should have the correct name', () => {
    const err = new FrameworkError('INVALID_RESPONSE', 'Invalid');
    expect(err.name).toBe('FrameworkError');
  });

  it('should preserve metadata', () => {
    const meta = { foo: 'bar', id: 123 };
    const err = new FrameworkError('PROJECT_ERROR', 'Project failed', meta);
    expect(err.metadata).toEqual(meta);
  });

  it('should have a stack trace', () => {
    const err = new FrameworkError('LLM_GENERATION_FAILED', 'Failed');
    expect(err.stack).toBeDefined();
    expect(typeof err.stack).toBe('string');
  });
});
