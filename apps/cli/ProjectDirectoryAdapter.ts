import { existsSync, mkdirSync, readdirSync } from 'fs';
import { join } from 'path';

export class ProjectDirectoryAdapter {
  private getProjectsPath(): string {
    return join(process.cwd(), 'projects');
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
    const path = join(this.getProjectsPath(), name);
    return existsSync(path);
  }

  public createProject(name: string): void {
    const path = join(this.getProjectsPath(), name);
    mkdirSync(path, { recursive: true });
  }
}
