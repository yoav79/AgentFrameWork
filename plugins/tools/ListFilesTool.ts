import * as fs from 'fs';
import * as path from 'path';
import { Tool } from '../../core/tools/Tool';
import { ToolResult } from '../../core/tools/ToolResult';
import { ToolPluginModule, PluginContext } from '../../core/plugins/contracts';

export class ListFilesTool implements Tool {
  public readonly name = 'list_files';
  public readonly description = 'Lists files and folders within a workspace directory, ignoring node_modules and .git.';
  private readonly baseDir: string;

  constructor(baseDir: string) {
    if (!fs.existsSync(baseDir)) {
      throw new Error(`Base directory does not exist: ${baseDir}`);
    }
    this.baseDir = fs.realpathSync(baseDir);
  }

  canHandle(actionType: string): boolean {
    return actionType === 'list_files';
  }

  execute(input: unknown): ToolResult {
    const payload = (typeof input === 'object' && input !== null) ? (input as Record<string, unknown>) : {};
    const requestedPath = typeof payload.path === 'string' ? payload.path : '';
    const recursive = payload.recursive === true;

    if (path.isAbsolute(requestedPath) || requestedPath.startsWith('/')) {
      return { success: false, error: 'Absolute paths are not allowed.' };
    }

    if (requestedPath.includes('..')) {
      return { success: false, error: 'Path traversal (..) is not allowed.' };
    }

    try {
      const targetDir = requestedPath ? path.resolve(this.baseDir, requestedPath) : this.baseDir;
      if (!fs.existsSync(targetDir)) {
        return { success: false, error: `Directory does not exist: ${requestedPath}` };
      }

      const stat = fs.statSync(targetDir);
      if (!stat.isDirectory()) {
        return { success: false, error: `Path is not a directory: ${requestedPath}` };
      }

      const realTarget = fs.realpathSync(targetDir);
      if (!realTarget.startsWith(this.baseDir)) {
        return { success: false, error: 'Resolved path is outside the allowed workspace boundary.' };
      }

      const files: Array<{ path: string; isDirectory: boolean; size?: number }> = [];
      this.scanDir(realTarget, '', recursive, files);

      return {
        success: true,
        message: `Found ${files.length} items in ${requestedPath || 'root'}.`,
        data: {
          path: requestedPath || '.',
          items: files
        }
      };
    } catch (err: any) {
      return { success: false, error: `Filesystem error: ${err.message}` };
    }
  }

  private scanDir(currentDir: string, relativePrefix: string, recursive: boolean, result: Array<{ path: string; isDirectory: boolean; size?: number }>) {
    const items = fs.readdirSync(currentDir);
    for (const item of items) {
      if (item === '.git' || item === 'node_modules') {
        continue;
      }

      const fullPath = path.join(currentDir, item);
      const relPath = relativePrefix ? path.join(relativePrefix, item) : item;
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        result.push({ path: relPath, isDirectory: true });
        if (recursive) {
          this.scanDir(fullPath, relPath, recursive, result);
        }
      } else {
        result.push({ path: relPath, isDirectory: false, size: stat.size });
      }
    }
  }
}

export const manifest: ToolPluginModule['manifest'] = {
  name: 'list_files',
  version: '1.0.0',
  kind: 'tool',
  actionType: 'list_files',
  description: 'Use ONLY when you need to list the files and directories in a workspace directory.\n   - Payload expected: { "path": "relative/directory/path", "recursive": false }\n   - MUST use relative paths. NO absolute paths.\n   - NO path traversal (..).',
  isTerminal: false,
  minConfidence: 0.8
};

export const create = (ctx: PluginContext): Tool => {
  return new ListFilesTool(ctx.workspaceRoot);
};
