import { describe, it, expect } from 'vitest';
import { ResponseNormalizer } from '../../../core/response/ResponseNormalizer';

describe('ResponseNormalizer', () => {
  it('should normalize a string to a message response', () => {
    const res = ResponseNormalizer.normalize('hello world');
    expect(res.type).toBe('message');
    expect(res.content).toBe('hello world');
  });

  it('should normalize an Error instance to an error response', () => {
    const err = new Error('test error');
    const res = ResponseNormalizer.normalize(err);
    expect(res.type).toBe('error');
    expect(res.content).toBe('test error');
  });

  it('should return a valid FrameworkResponse as is', () => {
    const input = { type: 'approval_required', content: 'approve?', metadata: { a: 1 } };
    const res = ResponseNormalizer.normalize(input);
    expect(res).toEqual(input);
  });

  it('should normalize an invalid object to an error response', () => {
    const input = { type: 'invalid_type', foo: 'bar' };
    const res = ResponseNormalizer.normalize(input);
    expect(res.type).toBe('error');
    expect(res.content).toContain('Failed to normalize response');
  });
});
