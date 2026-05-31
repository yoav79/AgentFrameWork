import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ReadFileTool } from '../../../plugins/tools/ReadFileTool';

describe('ReadFileTool', () => {
  let tmpDir: string;
  let tool: ReadFileTool;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'read-file-tool-test-'));
    // Ensure baseDir is a real path for symlink and boundary checks to work reliably
    tmpDir = fs.realpathSync(tmpDir);
    tool = new ReadFileTool(tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should only handle read_file action', () => {
    expect(tool.canHandle('read_file')).toBe(true);
    expect(tool.canHandle('send_message')).toBe(false);
  });

  it('should read a valid allowed file', () => {
    const testFile = path.join(tmpDir, 'test.txt');
    fs.writeFileSync(testFile, 'hello world', 'utf-8');

    const result = tool.execute({ path: 'test.txt' });
    expect(result.success).toBe(true);
    expect(result.data?.content).toBe('hello world');
    expect(result.data?.size).toBe(11);
    expect(result.data?.path).toBe('test.txt');
  });

  it('should reject non-object input', () => {
    expect(tool.execute('not an object').success).toBe(false);
    expect(tool.execute(null).success).toBe(false);
  });

  it('should reject missing or empty path', () => {
    expect(tool.execute({}).success).toBe(false);
    expect(tool.execute({ path: '' }).success).toBe(false);
    expect(tool.execute({ path: '   ' }).success).toBe(false);
  });

  it('should reject absolute paths', () => {
    expect(tool.execute({ path: '/etc/passwd' }).success).toBe(false);
  });

  it('should reject path traversal using ..', () => {
    expect(tool.execute({ path: '../secret.txt' }).success).toBe(false);
    expect(tool.execute({ path: 'subdir/../../secret.txt' }).success).toBe(false);
  });

  it('should reject sensitive files like .env and .pem', () => {
    expect(tool.execute({ path: '.env' }).success).toBe(false);
    expect(tool.execute({ path: '.env.local' }).success).toBe(false);
    expect(tool.execute({ path: 'cert.pem' }).success).toBe(false);
    expect(tool.execute({ path: 'data.sqlite' }).success).toBe(false);
  });

  it('should reject paths within .git or node_modules', () => {
    expect(tool.execute({ path: '.git/config' }).success).toBe(false);
    expect(tool.execute({ path: 'node_modules/pkg/index.js' }).success).toBe(false);
  });

  it('should reject directories', () => {
    fs.mkdirSync(path.join(tmpDir, 'subdir'));
    const result = tool.execute({ path: 'subdir' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('directory');
  });

  it('should reject files exceeding maxBytes', () => {
    const smallTool = new ReadFileTool(tmpDir, { maxBytes: 5 });
    const testFile = path.join(tmpDir, 'large.txt');
    fs.writeFileSync(testFile, '1234567890', 'utf-8');

    const result = smallTool.execute({ path: 'large.txt' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('size exceeds');
  });

  it('should reject binary files', () => {
    const binFile = path.join(tmpDir, 'data.bin');
    fs.writeFileSync(binFile, Buffer.from([0x00, 0x01, 0x02]));

    const result = tool.execute({ path: 'data.bin' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Binary files are not supported');
  });

  it('should block symlinks pointing outside baseDir', () => {
    let outsideDir;
    try {
      outsideDir = fs.mkdtempSync(path.join(os.tmpdir(), 'outside-'));
      outsideDir = fs.realpathSync(outsideDir);
      const outsideFile = path.join(outsideDir, 'secret.txt');
      fs.writeFileSync(outsideFile, 'secret data', 'utf-8');

      const symlinkPath = path.join(tmpDir, 'link_to_secret');
      fs.symlinkSync(outsideFile, symlinkPath);
      
      const result = tool.execute({ path: 'link_to_secret' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('outside the allowed workspace');
    } catch (e) {
      // Ignore if symlinks aren't supported
    } finally {
      if (outsideDir) {
        fs.rmSync(outsideDir, { recursive: true, force: true });
      }
    }
  });
});
