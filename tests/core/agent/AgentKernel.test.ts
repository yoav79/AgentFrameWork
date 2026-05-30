import { describe, it, expect } from 'vitest';
import { AgentKernel } from '../../../core/agent/AgentKernel';
import { InMemoryEventLog } from '../../../core/events/InMemoryEventLog';
import { StateResolver } from '../../../core/state/StateResolver';
import { ContextBuilder } from '../../../core/context/ContextBuilder';
import { PromptBuilder } from '../../../core/context/PromptBuilder';
import { DecisionParser } from '../../../core/routing/DecisionParser';
import { ActionExecutor } from '../../../core/flow/ActionExecutor';
import { LLMAdapter } from '../../../core/llm/LLMAdapter';
import { SkillRegistry } from '../../../core/skills/SkillRegistry';
import { Skill } from '../../../core/skills/Skill';

class MockLLMAdapter implements LLMAdapter {
  constructor(public responseContent: string) {}
  async generate() {
    return { content: this.responseContent };
  }
}

class MockSkill implements Skill {
  name = 'MockSkill';
  description = 'desc';
  canHandle(type: string) { return type === 'send_message'; }
  execute() { return { success: true, message: 'Executed!' }; }
}

describe('AgentKernel', () => {
  it('should run single pass successfully', async () => {
    const eventLog = new InMemoryEventLog();
    const stateResolver = new StateResolver();
    const contextBuilder = new ContextBuilder();
    const promptBuilder = new PromptBuilder();
    
    const validJson = JSON.stringify({
      intent: 'respond',
      confidence: 1,
      proposedAction: { type: 'send_message', payload: { message: 'hello' } }
    });
    const llmAdapter = new MockLLMAdapter(validJson);
    
    const decisionParser = new DecisionParser();
    const skillRegistry = new SkillRegistry();
    skillRegistry.register(new MockSkill());
    const actionExecutor = new ActionExecutor(skillRegistry);

    const kernel = new AgentKernel(
      eventLog, stateResolver, contextBuilder, promptBuilder,
      llmAdapter, decisionParser, actionExecutor
    );

    const result = await kernel.run({
      input: 'hello agent',
      projectId: 'proj-1',
      sessionId: 'sess-1'
    });

    expect(result.success).toBe(true);
    expect(result.result?.success).toBe(true);
    expect(result.decision?.intent).toBe('respond');
    expect(result.eventId).toBeDefined();
    
    const events = eventLog.getAll();
    expect(events.length).toBe(1);
    expect(events[0].payload).toMatchObject({ message: 'hello agent', projectId: 'proj-1' });
  });

  it('should propagate ActionExecutor failure as success: false without throwing', async () => {
    const eventLog = new InMemoryEventLog();
    const stateResolver = new StateResolver();
    const contextBuilder = new ContextBuilder();
    const promptBuilder = new PromptBuilder();
    
    const validJson = JSON.stringify({
      intent: 'respond',
      confidence: 1,
      proposedAction: { type: 'send_message', payload: { message: 'hello' } }
    });
    const llmAdapter = new MockLLMAdapter(validJson);
    const decisionParser = new DecisionParser();
    const actionExecutor = new ActionExecutor(new SkillRegistry()); // Empty registry!

    const kernel = new AgentKernel(
      eventLog, stateResolver, contextBuilder, promptBuilder,
      llmAdapter, decisionParser, actionExecutor
    );

    const result = await kernel.run({ input: 'hello' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('No compatible skill found');
  });

  it('should return controlled failure if LLM returns invalid JSON', async () => {
    const eventLog = new InMemoryEventLog();
    const llmAdapter = new MockLLMAdapter('This is not json');
    const actionExecutor = new ActionExecutor(new SkillRegistry());

    const kernel = new AgentKernel(
      eventLog, new StateResolver(), new ContextBuilder(), new PromptBuilder(),
      llmAdapter, new DecisionParser(), actionExecutor
    );

    const result = await kernel.run({ input: 'hello' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Failed to parse raw decision');
  });
});
