import { describe, it, expect } from 'vitest';
import { ResponseValidator } from '../../../core/response/ResponseValidator';

describe('ResponseValidator', () => {
  it('should validate a correct message response', () => {
    const input = { type: 'message', content: 'hello' };
    expect(ResponseValidator.isValidResponse(input)).toBe(true);
    expect(ResponseValidator.validate(input).isValid).toBe(true);
  });

  it('should validate a correct error response', () => {
    const input = { type: 'error', content: 'failed' };
    expect(ResponseValidator.isValidResponse(input)).toBe(true);
  });

  it('should validate a correct approval_required response', () => {
    const input = { type: 'approval_required', content: 'do you approve?' };
    expect(ResponseValidator.isValidResponse(input)).toBe(true);
  });

  it('should validate response with valid metadata', () => {
    const input = { type: 'message', content: 'hello', metadata: { key: 'value' } };
    expect(ResponseValidator.isValidResponse(input)).toBe(true);
  });

  it('should reject invalid types', () => {
    const input = { type: 'unknown_type', content: 'hello' };
    const res = ResponseValidator.validate(input);
    expect(res.isValid).toBe(false);
    expect(res.error).toContain('Invalid or missing type');
  });

  it('should reject non-string content', () => {
    const input = { type: 'message', content: 123 };
    const res = ResponseValidator.validate(input);
    expect(res.isValid).toBe(false);
    expect(res.error).toContain('Invalid or missing content');
  });

  it('should reject invalid metadata (array)', () => {
    const input = { type: 'message', content: 'hi', metadata: [] };
    const res = ResponseValidator.validate(input);
    expect(res.isValid).toBe(false);
    expect(res.error).toContain('Metadata must be a non-null object');
  });

  it('should reject invalid metadata (null)', () => {
    const input = { type: 'message', content: 'hi', metadata: null };
    const res = ResponseValidator.validate(input);
    expect(res.isValid).toBe(false);
  });

  it('should reject non-objects', () => {
    expect(ResponseValidator.validate(null).isValid).toBe(false);
    expect(ResponseValidator.validate(undefined).isValid).toBe(false);
    expect(ResponseValidator.validate('string').isValid).toBe(false);
  });
});
