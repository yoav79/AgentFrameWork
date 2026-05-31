import * as fs from 'fs';
import * as path from 'path';
import { Tool } from '../../core/tools/Tool';
import { ToolResult } from '../../core/tools/ToolResult';
import { ToolPluginModule, PluginContext } from '../../core/plugins/contracts';

export class WriteFileTool implements Tool {
  public readonly name = 'write_file';
  public readonly description = 'Writes or overwrites the content of a specific file within the workspace. Requires a relative path and content.';
  private readonly baseDir: string;

  private readonly blockedNamesAndExtensions = new Set([
    '.env', '.pem', '.key', '.crt', '.p12', '.sqlite', '.db'
  ]);

  constructor(baseDir: string) {
    if (!fs.existsSync(baseDir)) {
      throw new Error(`Base directory does not exist: ${baseDir}`);
    }
    this.baseDir = fs.realpathSync(baseDir);
  }

  canHandle(actionType: string): boolean {
    return actionType === 'write_file';
  }

  execute(input: unknown): ToolResult {
    if (typeof input !== 'object' || input === null) {
      return { success: false, error: 'Input must be an object containing "path" and "content" properties.' };
    }

    const payload = input as { path?: string; content?: string };
    const requestedPath = payload.path;
    const content = payload.content;

    if (!requestedPath || typeof requestedPath !== 'string' || requestedPath.trim() === '') {
      return { success: false, error: 'A valid non-empty "path" string is required.' };
    }

    if (content === undefined || typeof content !== 'string') {
      return { success: false, error: 'A valid "content" string is required.' };
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
      
      // Ensure target is within the workspace directory
      const dirPath = path.dirname(resolvedPath);
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
      
      const realDir = fs.realpathSync(dirPath);
      if (!realDir.startsWith(this.baseDir)) {
         return { success: false, error: 'Resolved path is outside the allowed workspace boundary.' };
      }

      fs.writeFileSync(resolvedPath, content, 'utf-8');

      return {
        success: true,
        message: `File written successfully at: ${requestedPath}`,
        data: {
          path: requestedPath,
          size: content.length
        }
      };

    } catch (err: any) {
       return { success: false, error: `Filesystem error: ${err.message}` };
    }
  }
}

export const manifest: ToolPluginModule['manifest'] = {
  name: 'write_file',
  version: '1.0.0',
  kind: 'tool',
  actionType: 'write_file',
  description: 'Use ONLY when you need to write or overwrite a specific file in the workspace.\n   - Payload expected: { "path": "relative/path.ts", "content": "file content here" }\n   - MUST use relative paths. NO absolute paths.\n   - NO path traversal (..).\n   - DO NOT write to secrets, .env, .git, or node_modules.',
  isTerminal: false,
  minConfidence: 0.9
};

export const create = (ctx: PluginContext): Tool => {
  return new WriteFileTool(ctx.workspaceRoot);
};
