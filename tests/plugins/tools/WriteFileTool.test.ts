import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { WriteFileTool } from '../../../plugins/tools/WriteFileTool';

describe('WriteFileTool', () => {
  let tmpDir: string;
  let tool: WriteFileTool;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'write-file-tool-test-'));
    tmpDir = fs.realpathSync(tmpDir);
    tool = new WriteFileTool(tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should only handle write_file action', () => {
    expect(tool.canHandle('write_file')).toBe(true);
    expect(tool.canHandle('read_file')).toBe(false);
  });

  it('should write a valid allowed file', () => {
    const testFile = 'test.txt';
    const result = tool.execute({ path: testFile, content: 'hello world' });
    
    expect(result.success).toBe(true);
    const contentOnDisk = fs.readFileSync(path.join(tmpDir, testFile), 'utf-8');
    expect(contentOnDisk).toBe('hello world');
  });

  it('should reject non-object input', () => {
    expect(tool.execute('not an object').success).toBe(false);
    expect(tool.execute(null).success).toBe(false);
  });

  it('should reject missing path or content', () => {
    expect(tool.execute({ path: 'test.txt' }).success).toBe(false);
    expect(tool.execute({ content: 'hello' }).success).toBe(false);
    expect(tool.execute({ path: '', content: 'hello' }).success).toBe(false);
  });

  it('should reject absolute paths', () => {
    expect(tool.execute({ path: '/etc/passwd', content: 'hacked' }).success).toBe(false);
  });

  it('should reject path traversal using ..', () => {
    expect(tool.execute({ path: '../secret.txt', content: 'hacked' }).success).toBe(false);
    expect(tool.execute({ path: 'subdir/../../secret.txt', content: 'hacked' }).success).toBe(false);
  });

  it('should reject sensitive files like .env and .pem', () => {
    expect(tool.execute({ path: '.env', content: 'SECRET=true' }).success).toBe(false);
    expect(tool.execute({ path: '.env.local', content: 'SECRET=true' }).success).toBe(false);
    expect(tool.execute({ path: 'cert.pem', content: 'KEY' }).success).toBe(false);
    expect(tool.execute({ path: 'data.sqlite', content: 'SQL' }).success).toBe(false);
  });

  it('should reject paths within .git or node_modules', () => {
    expect(tool.execute({ path: '.git/config', content: 'hacked' }).success).toBe(false);
    expect(tool.execute({ path: 'node_modules/pkg/index.js', content: 'hacked' }).success).toBe(false);
  });
});
