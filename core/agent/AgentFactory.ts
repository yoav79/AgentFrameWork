import { LLMAdapter } from '../llm/LLMAdapter';
import { AgentKernel } from './AgentKernel';
import { InMemoryEventLog } from '../events/InMemoryEventLog';
import { StateResolver } from '../state/StateResolver';
import { ContextBuilder } from '../context/ContextBuilder';
import { PromptBuilder } from '../context/PromptBuilder';
import { DecisionParser } from '../routing/DecisionParser';
import { SkillRegistry } from '../skills/SkillRegistry';
import { SendMessageSkill } from '../skills/SendMessageSkill';
import { ActionExecutor } from '../flow/ActionExecutor';

export class AgentFactory {
  public static create(llmAdapter: LLMAdapter): AgentKernel {
    const eventLog = new InMemoryEventLog();
    const stateResolver = new StateResolver();
    const contextBuilder = new ContextBuilder();
    const promptBuilder = new PromptBuilder();
    const decisionParser = new DecisionParser();
    
    const skillRegistry = new SkillRegistry();
    skillRegistry.register(new SendMessageSkill());
    
    const actionExecutor = new ActionExecutor(skillRegistry);

    return new AgentKernel(
      eventLog,
      stateResolver,
      contextBuilder,
      promptBuilder,
      llmAdapter,
      decisionParser,
      actionExecutor
    );
  }
}
