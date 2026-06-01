import * as fs from 'fs';
import * as path from 'path';
import { LLMAdapter } from '../llm/LLMAdapter';
import { AgentKernel } from './AgentKernel';
import { EventLogFactory, EventLogFactoryOptions } from '../events/EventLogFactory';
import { StateResolver } from '../state/StateResolver';
import { ContextBuilder } from '../context/ContextBuilder';
import { PromptBuilder } from '../context/PromptBuilder';
import { DecisionParser } from '../routing/DecisionParser';
import { SkillRegistry } from '../skills/SkillRegistry';
import { getNativeSkillActionTypes, getNativeSkillDefinitions } from '../skills/NativeSkills';
import { ActionExecutor } from '../flow/ActionExecutor';
import { PolicyEngine } from '../policy/PolicyEngine';
import { MemoryReader } from '../memory/MemoryReader';
import { ToolRegistry } from '../tools/ToolRegistry';
import { FlowConfig } from '../flow/FlowConfig';
import { PluginLoader, WorkspacePluginsConfig } from '../plugins/PluginLoader';

import { AgentProfile } from './AgentProfile';
import { AgentProfileLoader } from './AgentProfileLoader';


export interface AgentFactoryOptions extends EventLogFactoryOptions {
  workspaceRoot?: string;
  flowConfig?: FlowConfig;
  debug?: boolean;
  agentProfile?: AgentProfile;
}

import { ActionCatalog } from '../actions/ActionCatalog';

export class AgentFactory {
  public static create(llmAdapter: LLMAdapter, options?: AgentFactoryOptions): AgentKernel {
    const eventLog = EventLogFactory.create(options);
    const stateResolver = new StateResolver();
    const contextBuilder = new ContextBuilder();
    
    const root = options?.workspaceRoot || process.cwd();

    let effectiveProfile = options?.agentProfile;
    if (!effectiveProfile && options?.workspaceRoot) {
      const profilePath = path.join(options.workspaceRoot, 'profile.json');
      const loaded = AgentProfileLoader.loadFromFile(profilePath, options.workspaceRoot);
      if (loaded) {
        effectiveProfile = loaded;
      }
    }

    if (effectiveProfile?.allowedSkills) {
      if (effectiveProfile.allowedSkills.length === 0) {
        throw new Error('[AgentFactory] AgentProfile.allowedSkills cannot be empty in interactive agents.');
      }
      const validBaseSkills = getNativeSkillActionTypes();
      for (const skill of effectiveProfile.allowedSkills) {
        if (!validBaseSkills.includes(skill)) {
          throw new Error(`[AgentFactory] AgentProfile references unknown base skill: ${skill}`);
        }
      }
    }

    // Create the session-specific ActionCatalog instance
    const actionCatalog = new ActionCatalog(undefined, effectiveProfile?.allowedSkills);

    const promptBuilder = new PromptBuilder(actionCatalog, effectiveProfile);
    const decisionParser = new DecisionParser(actionCatalog);
    const policyEngine = new PolicyEngine(actionCatalog);
    const memoryReader = new MemoryReader(eventLog);
    
    const skillRegistry = new SkillRegistry();
    for (const def of getNativeSkillDefinitions()) {
      if (!effectiveProfile?.allowedSkills || effectiveProfile.allowedSkills.includes(def.actionType)) {
        skillRegistry.register(new def.skillClass());
      }
    }
    
    const toolRegistry = new ToolRegistry();
    
    // Load projects/<id>/agent.config.json or fallback to enabling read_file
    const configPath = path.join(root, 'agent.config.json');
    let pluginsConfig: WorkspacePluginsConfig = {
      plugins: {
        read_file: {
          enabled: true
        }
      }
    };
    
    if (fs.existsSync(configPath)) {
      try {
        const fileContent = fs.readFileSync(configPath, 'utf-8');
        pluginsConfig = JSON.parse(fileContent);
      } catch (err) {
        console.error(`Error parsing agent.config.json in ${root}: ${(err as Error).message}`);
      }
    }

    if (effectiveProfile && effectiveProfile.enabledPlugins !== undefined) {
      const globalPlugins = pluginsConfig.plugins || {};
      const filteredPlugins: Record<string, { enabled: boolean; config?: Record<string, unknown> }> = {};
      
      for (const pluginName of effectiveProfile.enabledPlugins) {
        const globalDef = globalPlugins[pluginName];
        if (!globalDef) {
          throw new Error(`[AgentFactory] AgentProfile references unknown plugin: ${pluginName}`);
        }
        if (globalDef.enabled !== true) {
          throw new Error(`[AgentFactory] AgentProfile references disabled plugin: ${pluginName}`);
        }
        filteredPlugins[pluginName] = globalDef;
      }
      
      pluginsConfig = { ...pluginsConfig, plugins: filteredPlugins };
    }

    const isDebug = options?.debug || false;
    const logger = {
      info: (...args: unknown[]) => {
        if (isDebug) {
          console.log('\x1b[90m[PluginLoader] INFO:\x1b[0m', ...args);
        }
      },
      warn: (...args: unknown[]) => {
        console.warn('\x1b[33m[PluginLoader] WARN:\x1b[0m', ...args);
      },
      error: (...args: unknown[]) => {
        console.error('\x1b[31m[PluginLoader] ERROR:\x1b[0m', ...args);
      }
    };

    const baseContext = {
      workspaceRoot: root,
      projectId: options?.projectId,
      sessionId: options?.sessionId,
      logger
    };

    const pluginsDir = path.join(process.cwd(), 'dist/plugins/tools');
    PluginLoader.loadPlugins(pluginsDir, pluginsConfig, baseContext, toolRegistry, actionCatalog, effectiveProfile?.allowedTools);
    
    const actionExecutor = new ActionExecutor(skillRegistry, toolRegistry);

    return new AgentKernel(
      eventLog,
      stateResolver,
      contextBuilder,
      promptBuilder,
      llmAdapter,
      decisionParser,
      policyEngine,
      actionExecutor,
      memoryReader,
      options?.flowConfig,
      actionCatalog
    );
  }
}
