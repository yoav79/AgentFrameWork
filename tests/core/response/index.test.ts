import { describe, it, expect } from 'vitest';
import * as ResponseModule from '../../../core/response';

describe('core/response index', () => {
  it('should export essential classes and constants', () => {
    expect(ResponseModule.ResponseSchemaFactory).toBeDefined();
    expect(ResponseModule.ResponseValidator).toBeDefined();
    expect(ResponseModule.ResponseNormalizer).toBeDefined();
    expect(ResponseModule.RESPONSE_TYPES).toBeDefined();
  });
});
