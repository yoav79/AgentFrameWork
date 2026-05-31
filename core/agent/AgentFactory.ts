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
import { SendMessageSkill } from '../skills/SendMessageSkill';
import { ActionExecutor } from '../flow/ActionExecutor';
import { PolicyEngine } from '../policy/PolicyEngine';
import { MemoryReader } from '../memory/MemoryReader';
import { ToolRegistry } from '../tools/ToolRegistry';
import { FlowConfig } from '../flow/FlowConfig';
import { PluginLoader } from '../plugins/PluginLoader';

export interface AgentFactoryOptions extends EventLogFactoryOptions {
  workspaceRoot?: string;
  flowConfig?: FlowConfig;
  debug?: boolean;
}

export class AgentFactory {
  public static create(llmAdapter: LLMAdapter, options?: AgentFactoryOptions): AgentKernel {
    const eventLog = EventLogFactory.create(options);
    const stateResolver = new StateResolver();
    const contextBuilder = new ContextBuilder();
    const promptBuilder = new PromptBuilder();
    const decisionParser = new DecisionParser();
    const policyEngine = new PolicyEngine();
    const memoryReader = new MemoryReader(eventLog);
    
    const skillRegistry = new SkillRegistry();
    skillRegistry.register(new SendMessageSkill());
    
    const toolRegistry = new ToolRegistry();
    const root = options?.workspaceRoot || process.cwd();
    
    // Load projects/<id>/agent.config.json or fallback to enabling read_file
    const configPath = path.join(root, 'agent.config.json');
    let pluginsConfig = {
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
    PluginLoader.loadPlugins(pluginsDir, pluginsConfig, baseContext, toolRegistry);
    
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
      options?.flowConfig
    );
  }
}
