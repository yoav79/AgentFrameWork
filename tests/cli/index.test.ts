import { describe, it, expect } from 'vitest';
import * as cliIndex from '../../apps/cli/index';

describe('CLI Index exports', () => {
  it('should export CommandHandler', () => {
    expect(cliIndex.CommandHandler).toBeDefined();
    expect(typeof cliIndex.CommandHandler).toBe('function');
  });

  it('should export Renderer', () => {
    expect(cliIndex.Renderer).toBeDefined();
    expect(typeof cliIndex.Renderer).toBe('function');
  });
});
