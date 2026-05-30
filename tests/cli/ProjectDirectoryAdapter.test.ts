import { describe, it, expect, vi, afterEach } from 'vitest';
import { ProjectDirectoryAdapter } from '../../apps/cli/ProjectDirectoryAdapter';
import * as fs from 'fs';
import { FrameworkError } from '../../core/errors/FrameworkError';

vi.mock('fs');

describe('ProjectDirectoryAdapter', () => {
  const adapter = new ProjectDirectoryAdapter();

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should return empty list if path does not exist', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    expect(adapter.listProjects()).toEqual([]);
  });

  it('should list projects', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readdirSync).mockReturnValue([
      { name: 'proj1', isDirectory: () => true },
      { name: 'file1', isDirectory: () => false },
    ] as any);

    const projects = adapter.listProjects();
    expect(projects).toEqual(['proj1']);
  });

  it('should detect if project exists', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    expect(adapter.projectExists('proj1')).toBe(true);
  });

  it('should create project', () => {
    adapter.createProject('proj1');
    expect(fs.mkdirSync).toHaveBeenCalledWith(expect.stringContaining('proj1'), { recursive: true });
  });

  it('should throw VALIDATION_ERROR on empty project name', () => {
    expect(() => adapter.projectExists('')).toThrow(FrameworkError);
    expect(() => adapter.createProject('  ')).toThrow(FrameworkError);
  });

  it('should throw VALIDATION_ERROR on invalid characters (path traversal)', () => {
    expect(() => adapter.createProject('../evil')).toThrow(FrameworkError);
    expect(() => adapter.createProject('..')).toThrow(FrameworkError);
    expect(() => adapter.createProject('.')).toThrow(FrameworkError);
    expect(() => adapter.createProject('/tmp/evil')).toThrow(FrameworkError);
    expect(() => adapter.createProject('evil\\path')).toThrow(FrameworkError);
  });
});
