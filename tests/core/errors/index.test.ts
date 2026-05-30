import { describe, it, expect } from 'vitest';
import { FrameworkError, ERROR_CODES, ErrorCode } from '../../../core/errors';

describe('core/errors index', () => {
  it('should export FrameworkError', () => {
    expect(FrameworkError).toBeDefined();
    const err = new FrameworkError('INTERNAL_ERROR', 'Test');
    expect(err.name).toBe('FrameworkError');
  });

  it('should export ERROR_CODES with correct keys', () => {
    expect(ERROR_CODES.LLM_GENERATION_FAILED).toBe('LLM_GENERATION_FAILED');
    expect(ERROR_CODES.INVALID_RESPONSE).toBe('INVALID_RESPONSE');
    expect(ERROR_CODES.NOT_IMPLEMENTED).toBe('NOT_IMPLEMENTED');
    expect(ERROR_CODES.PROJECT_ERROR).toBe('PROJECT_ERROR');
    expect(ERROR_CODES.INTERNAL_ERROR).toBe('INTERNAL_ERROR');
  });
});
