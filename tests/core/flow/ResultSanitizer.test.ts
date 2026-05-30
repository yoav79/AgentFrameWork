import { describe, it, expect } from 'vitest';
import { ResultSanitizer, MAX_VERBOSE_FIELD_LENGTH } from '../../../core/flow/ResultSanitizer';

describe('ResultSanitizer', () => {
  it('should handle undefined and null', () => {
    expect(ResultSanitizer.sanitizeData(undefined)).toBeUndefined();
    expect(ResultSanitizer.sanitizeData(null)).toBeNull();
  });

  it('should handle primitives without error', () => {
    expect(ResultSanitizer.sanitizeData('test')).toBe('test');
    expect(ResultSanitizer.sanitizeData(42)).toBe(42);
    expect(ResultSanitizer.sanitizeData(true)).toBe(true);
  });

  it('should completely remove fields in the DENY_LIST', () => {
    const input = {
      path: '/test.txt',
      content: 'heavy data',
      raw: 'heavy data',
      buffer: Buffer.from('heavy data'),
      blob: new ArrayBuffer(8),
      base64: 'dGVzdA==',
      base64Data: 'dGVzdA==',
      size: 1024
    };

    const output = ResultSanitizer.sanitizeData(input) as any;

    expect(output.path).toBe('/test.txt');
    expect(output.size).toBe(1024);
    
    expect(output.content).toBeUndefined();
    expect(output.raw).toBeUndefined();
    expect(output.buffer).toBeUndefined();
    expect(output.blob).toBeUndefined();
    expect(output.base64).toBeUndefined();
    expect(output.base64Data).toBeUndefined();
  });

  it('should truncate excessively long strings in the VERBOSE_LIST', () => {
    const hugeString = 'A'.repeat(MAX_VERBOSE_FIELD_LENGTH + 500);
    const input = {
      actionType: 'run_cmd',
      stdout: hugeString,
      stderr: 'short error'
    };

    const output = ResultSanitizer.sanitizeData(input) as any;

    expect(output.actionType).toBe('run_cmd');
    expect(output.stderr).toBe('short error');
    expect(output.stderrTruncated).toBeUndefined();

    expect(output.stdout.length).toBe(MAX_VERBOSE_FIELD_LENGTH);
    expect(output.stdoutTruncated).toBe(true);
  });

  it('should truncate large arrays in the VERBOSE_LIST', () => {
    const hugeArray = new Array(100).fill('log');
    const input = {
      logs: hugeArray
    };

    const output = ResultSanitizer.sanitizeData(input) as any;
    expect(output.logs.length).toBe(50);
    expect(output.logsTruncated).toBe(true);
  });

  it('should not mutate the original object', () => {
    const original = {
      path: '/test',
      content: 'original content',
      stdout: 'A'.repeat(MAX_VERBOSE_FIELD_LENGTH + 10)
    };
    
    // Create a copy to ensure immutability check
    const copyOfOriginal = { ...original };
    
    const output = ResultSanitizer.sanitizeData(original) as any;

    expect(output).not.toBe(original);
    
    // Ensure original object is not touched
    expect(original.content).toBe('original content');
    expect(original.stdout.length).toBe(MAX_VERBOSE_FIELD_LENGTH + 10);
    expect(original).toEqual(copyOfOriginal);
  });

  it('should return a shallow copy for arrays (MVP decision)', () => {
    const input = [{ content: 'test' }, { content: 'test2' }];
    const output = ResultSanitizer.sanitizeData(input) as any;

    expect(Array.isArray(output)).toBe(true);
    expect(output).not.toBe(input);
    expect(output[0].content).toBe('test'); // MVP: shallow array copy does not sanitize elements inside
  });
});
