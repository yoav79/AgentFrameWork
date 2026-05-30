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
import { ReadFileTool } from '../tools';

export interface AgentFactoryOptions extends EventLogFactoryOptions {
  workspaceRoot?: string;
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
    toolRegistry.register(new ReadFileTool(root));
    
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
      memoryReader
    );
  }
}
