import * as fs from 'fs';
import * as path from 'path';
import { ToolRegistry } from '../tools/ToolRegistry';
import { PluginContext, ToolPluginModule } from './contracts';

export interface WorkspacePluginsConfig {
  plugins?: Record<string, {
    enabled: boolean;
    config?: Record<string, unknown>;
  }>;
}

export class PluginLoader {
  public static loadPlugins(
    pluginsDir: string,
    config: WorkspacePluginsConfig,
    baseContext: Omit<PluginContext, 'config'>,
    registry: ToolRegistry
  ): void {
    if (!fs.existsSync(pluginsDir)) {
      baseContext.logger.warn(`Plugins directory does not exist: ${pluginsDir}`);
      return;
    }

    const files = fs.readdirSync(pluginsDir);
    const allowlist = config.plugins || {};

    for (const file of files) {
      // Load only compiled .js files in production/runtime to prevent Dev/Prod incompatibility
      if (!file.endsWith('.js')) {
        continue;
      }

      const resolvedPath = path.resolve(pluginsDir, file);

      try {
        const pluginModule: ToolPluginModule = require(resolvedPath);

        // Validation of shape
        if (!pluginModule || typeof pluginModule !== 'object') {
          baseContext.logger.warn(`Plugin file ${file} does not export a valid module object.`);
          continue;
        }

        const manifest = pluginModule.manifest;
        if (!manifest || manifest.kind !== 'tool' || !manifest.name || !manifest.actionType) {
          baseContext.logger.warn(`Plugin file ${file} has an invalid or missing manifest.`);
          continue;
        }

        if (typeof pluginModule.create !== 'function') {
          baseContext.logger.warn(`Plugin file ${file} does not export a valid 'create' function.`);
          continue;
        }

        // Check if plugin is in the allowlist and enabled (deny-by-default)
        const pluginConf = allowlist[manifest.name];
        if (!pluginConf || !pluginConf.enabled) {
          baseContext.logger.info(`Plugin ${manifest.name} (${manifest.actionType}) is not in the allowlist or is disabled.`);
          continue;
        }

        // Merge generic context with plugin-specific config from manifest/allowlist
        const pluginContext: PluginContext = {
          ...baseContext,
          config: {
            ...(pluginConf.config || {})
          }
        };

        const tool = pluginModule.create(pluginContext);
        registry.register(tool);
        baseContext.logger.info(`Successfully loaded and registered plugin: ${manifest.name} [${manifest.actionType}]`);
      } catch (err) {
        baseContext.logger.error(`Failed to load plugin ${file}: ${(err as Error).message}`);
      }
    }
  }
}
