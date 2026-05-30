import { describe, it, expect } from 'vitest';
import * as ConfigModule from '../../../core/config';

describe('core/config index', () => {
  it('should export ConfigFactory', () => {
    expect(ConfigModule.ConfigFactory).toBeDefined();
  });
});
