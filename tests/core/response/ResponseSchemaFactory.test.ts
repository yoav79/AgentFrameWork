import { describe, it, expect } from 'vitest';
import { ResponseSchemaFactory, RESPONSE_TYPES } from '../../../core/response/ResponseSchemaFactory';

describe('ResponseSchemaFactory', () => {
  it('should export valid response types', () => {
    expect(RESPONSE_TYPES).toContain('message');
    expect(RESPONSE_TYPES).toContain('error');
    expect(RESPONSE_TYPES).toContain('approval_required');
  });

  it('should return a valid base schema', () => {
    const schema = ResponseSchemaFactory.getBaseSchema();
    expect(schema.type).toBe('object');
    expect(schema.required).toContain('type');
    expect(schema.required).toContain('content');
  });
});
