import { describe, it, expect } from 'vitest';
import * as KernelModule from '../../../core/kernel';

describe('core/kernel index', () => {
  it('should export Kernel and KernelOptions', () => {
    expect(KernelModule.Kernel).toBeDefined();
  });
});
