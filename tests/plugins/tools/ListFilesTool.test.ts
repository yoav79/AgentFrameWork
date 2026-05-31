import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ListFilesTool } from '../../../plugins/tools/ListFilesTool';

describe('ListFilesTool', () => {
  let tmpDir: string;
  let tool: ListFilesTool;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'list-files-tool-test-'));
    tmpDir = fs.realpathSync(tmpDir);
    
    // Create some files and subdirectories
    fs.writeFileSync(path.join(tmpDir, 'file1.txt'), 'hello', 'utf-8');
    fs.mkdirSync(path.join(tmpDir, 'subdir'));
    fs.writeFileSync(path.join(tmpDir, 'subdir', 'file2.txt'), 'world', 'utf-8');
    fs.mkdirSync(path.join(tmpDir, 'node_modules'));
    fs.writeFileSync(path.join(tmpDir, 'node_modules', 'dep.js'), 'code', 'utf-8');
    
    tool = new ListFilesTool(tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should only handle list_files action', () => {
    expect(tool.canHandle('list_files')).toBe(true);
    expect(tool.canHandle('read_file')).toBe(false);
  });

  it('should list files in root directory non-recursively', () => {
    const result = tool.execute({});
    expect(result.success).toBe(true);
    const items = result.data?.items as any[];
    expect(items.length).toBe(2); // file1.txt, subdir (node_modules is ignored)
    expect(items.map(i => i.path)).toContain('file1.txt');
    expect(items.map(i => i.path)).toContain('subdir');
  });

  it('should list files recursively when recursive is true', () => {
    const result = tool.execute({ recursive: true });
    expect(result.success).toBe(true);
    const items = result.data?.items as any[];
    expect(items.length).toBe(3); // file1.txt, subdir, subdir/file2.txt (node_modules ignored)
    expect(items.map(i => i.path)).toContain('subdir/file2.txt');
  });

  it('should reject absolute paths or traversal', () => {
    expect(tool.execute({ path: '/etc' }).success).toBe(false);
    expect(tool.execute({ path: '../' }).success).toBe(false);
  });
});
