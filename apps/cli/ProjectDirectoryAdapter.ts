import { existsSync, mkdirSync, readdirSync } from 'fs';
import { join } from 'path';
import { FrameworkError } from '../../core/errors/FrameworkError';

export class ProjectDirectoryAdapter {
  private getProjectsPath(): string {
    return join(process.cwd(), 'projects');
  }

  private validateProjectName(name: string): void {
    if (!name || name.trim() === '') {
      throw new FrameworkError('VALIDATION_ERROR', 'Project name cannot be empty');
    }
    if (/[^a-zA-Z0-9_-]/.test(name)) {
      throw new FrameworkError('VALIDATION_ERROR', 'Project name can only contain alphanumeric characters, hyphens, and underscores');
    }
  }

  public listProjects(): string[] {
    try {
      const path = this.getProjectsPath();
      if (!existsSync(path)) {
        return [];
      }
      return readdirSync(path, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name);
    } catch {
      return [];
    }
  }

  public projectExists(name: string): boolean {
    this.validateProjectName(name);
    const path = join(this.getProjectsPath(), name);
    return existsSync(path);
  }

  public createProject(name: string): void {
    this.validateProjectName(name);
    const path = join(this.getProjectsPath(), name);
    mkdirSync(path, { recursive: true });
  }
}
