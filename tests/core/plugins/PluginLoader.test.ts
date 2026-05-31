import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { PluginLoader } from '../../../core/plugins/PluginLoader';
import { ToolRegistry } from '../../../core/tools/ToolRegistry';

describe('PluginLoader', () => {
  const tempPluginsDir = path.resolve(__dirname, 'temp-plugins');

  beforeAll(() => {
    if (!fs.existsSync(tempPluginsDir)) {
      fs.mkdirSync(tempPluginsDir, { recursive: true });
    }
  });

  afterAll(() => {
    if (fs.existsSync(tempPluginsDir)) {
      fs.rmSync(tempPluginsDir, { recursive: true, force: true });
    }
  });

  it('loads, validates, and registers a valid plugin that is in the allowlist', async () => {
    const pluginCode = `
      module.exports = {
        manifest: {
          name: 'test_plugin',
          version: '1.0.0',
          kind: 'tool',
          actionType: 'test_action'
        },
        create: (ctx) => {
          return {
            name: 'test_plugin_instance',
            canHandle: (type) => type === 'test_action',
            execute: async (decision) => {
              return {
                success: true,
                message: 'Hello from plugin',
                data: { configValue: ctx.config.someKey, root: ctx.workspaceRoot }
              };
            }
          };
        }
      };
    `;

    const pluginPath = path.join(tempPluginsDir, 'testPlugin.js');
    fs.writeFileSync(pluginPath, pluginCode);

    const registry = new ToolRegistry();
    const logs: string[] = [];
    const baseContext = {
      workspaceRoot: '/mock/root',
      logger: {
        info: (msg: any) => logs.push(`[INFO] ${msg}`),
        warn: (msg: any) => logs.push(`[WARN] ${msg}`),
        error: (msg: any) => logs.push(`[ERROR] ${msg}`)
      }
    };

    const config = {
      plugins: {
        test_plugin: {
          enabled: true,
          config: { someKey: 'secret_value' }
        }
      }
    };

    PluginLoader.loadPlugins(tempPluginsDir, config, baseContext, registry);

    const tool = registry.getToolForAction('test_action');
    expect(tool).toBeDefined();
    expect(tool?.name).toBe('test_plugin_instance');

    const result = await tool?.execute({
      intent: 'respond',
      confidence: 1,
      proposedAction: { type: 'test_action', payload: {} }
    });

    expect(result?.success).toBe(true);
    expect(result?.message).toBe('Hello from plugin');
    expect(result?.data).toEqual({ configValue: 'secret_value', root: '/mock/root' });

    expect(logs.some(l => l.includes('Successfully loaded and registered plugin'))).toBe(true);
  });

  it('ignores plugin that is not in the allowlist (deny-by-default)', async () => {
    const pluginCode = `
      module.exports = {
        manifest: {
          name: 'disabled_plugin',
          version: '1.0.0',
          kind: 'tool',
          actionType: 'disabled_action'
        },
        create: (ctx) => ({})
      };
    `;

    const pluginPath = path.join(tempPluginsDir, 'disabledPlugin.js');
    fs.writeFileSync(pluginPath, pluginCode);

    const registry = new ToolRegistry();
    const logs: string[] = [];
    const baseContext = {
      workspaceRoot: '/mock/root',
      logger: {
        info: (msg: any) => logs.push(`[INFO] ${msg}`),
        warn: (msg: any) => logs.push(`[WARN] ${msg}`),
        error: (msg: any) => logs.push(`[ERROR] ${msg}`)
      }
    };

    const config = {
      plugins: {
        disabled_plugin: {
          enabled: false
        }
      }
    };

    PluginLoader.loadPlugins(tempPluginsDir, config, baseContext, registry);

    const tool = registry.getToolForAction('disabled_action');
    expect(tool).toBeUndefined();
    expect(logs.some(l => l.includes('is not in the allowlist or is disabled'))).toBe(true);
  });
});
