import * as fs from 'fs';
import * as path from 'path';
import { Tool } from '../../core/tools/Tool';
import { ToolResult } from '../../core/tools/ToolResult';
import { ToolPluginModule, PluginContext } from '../../core/plugins/contracts';

export class ReadFileTool implements Tool {
  public readonly name = 'read_file';
  public readonly description = 'Reads the content of a specific file within the allowed workspace. Requires a relative path.';
  private readonly baseDir: string;
  private readonly maxBytes: number;

  private readonly blockedNamesAndExtensions = new Set([
    '.env', '.pem', '.key', '.crt', '.p12', '.sqlite', '.db'
  ]);

  constructor(baseDir: string, options?: { maxBytes?: number }) {
    if (!fs.existsSync(baseDir)) {
      throw new Error(`Base directory does not exist: ${baseDir}`);
    }
    this.baseDir = fs.realpathSync(baseDir);
    this.maxBytes = options?.maxBytes ?? 100 * 1024; // default 100KB
  }

  canHandle(actionType: string): boolean {
    return actionType === 'read_file';
  }

  execute(input: unknown): ToolResult {
    if (typeof input !== 'object' || input === null) {
      return { success: false, error: 'Input must be an object containing a "path" property.' };
    }

    const payload = input as { path?: string };
    const requestedPath = payload.path;

    if (!requestedPath || typeof requestedPath !== 'string' || requestedPath.trim() === '') {
      return { success: false, error: 'A valid non-empty "path" string is required.' };
    }

    if (path.isAbsolute(requestedPath) || requestedPath.startsWith('/')) {
      return { success: false, error: 'Absolute paths are not allowed.' };
    }

    if (requestedPath.includes('..')) {
      return { success: false, error: 'Path traversal (..) is not allowed.' };
    }

    // Check against blacklisted paths
    const normalizedRequested = requestedPath.replace(/\\/g, '/');
    const pathSegments = normalizedRequested.split('/').filter(Boolean);
    for (const segment of pathSegments) {
      if (segment === '.git' || segment === 'node_modules' || segment === '.env' || segment.startsWith('.env.')) {
         return { success: false, error: `Access to sensitive path segment '${segment}' is blocked.` };
      }
      for (const ext of this.blockedNamesAndExtensions) {
        if (segment.endsWith(ext) || segment === ext) {
          return { success: false, error: `Access to sensitive file type '${ext}' is blocked.` };
        }
      }
    }

    try {
      const resolvedPath = path.resolve(this.baseDir, requestedPath);
      
      if (!fs.existsSync(resolvedPath)) {
        return { success: false, error: 'File does not exist.' };
      }

      const realPath = fs.realpathSync(resolvedPath);

      if (!realPath.startsWith(this.baseDir)) {
         return { success: false, error: 'Resolved path is outside the allowed workspace boundary.' };
      }

      const stats = fs.statSync(realPath);

      if (stats.isDirectory()) {
         return { success: false, error: 'Requested path is a directory, not a file.' };
      }

      if (stats.size > this.maxBytes) {
         return { success: false, error: `File size exceeds the maximum allowed limit of ${this.maxBytes} bytes.` };
      }

      // Check for binary by looking at a chunk
      const buffer = Buffer.alloc(Math.min(stats.size, 100));
      const fd = fs.openSync(realPath, 'r');
      fs.readSync(fd, buffer, 0, buffer.length, 0);
      fs.closeSync(fd);

      if (buffer.includes(0x00)) {
         return { success: false, error: 'Binary files are not supported.' };
      }

      const content = fs.readFileSync(realPath, 'utf-8');

      return {
        success: true,
        message: 'File read successfully',
        data: {
          path: requestedPath,
          content,
          size: stats.size
        }
      };

    } catch (err: any) {
       return { success: false, error: `Filesystem error: ${err.message}` };
    }
  }
}

export const manifest: ToolPluginModule['manifest'] = {
  name: 'read_file',
  version: '1.0.0',
  kind: 'tool',
  actionType: 'read_file'
};

export const create = (ctx: PluginContext): Tool => {
  const maxBytes = ctx.config.maxBytes ? Number(ctx.config.maxBytes) : undefined;
  return new ReadFileTool(ctx.workspaceRoot, { maxBytes });
};
