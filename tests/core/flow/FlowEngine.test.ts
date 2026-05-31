import { describe, it, expect } from 'vitest';
import { FlowEngine } from '../../../core/flow/FlowEngine';
import { InMemoryEventLog } from '../../../core/events/InMemoryEventLog';
import { StateResolver } from '../../../core/state/StateResolver';
import { ContextBuilder } from '../../../core/context/ContextBuilder';
import { PromptBuilder } from '../../../core/context/PromptBuilder';
import { DecisionParser } from '../../../core/routing/DecisionParser';
import { ActionExecutor } from '../../../core/flow/ActionExecutor';
import { LLMAdapter } from '../../../core/llm/LLMAdapter';
import { SkillRegistry } from '../../../core/skills/SkillRegistry';
import { PolicyEngine } from '../../../core/policy/PolicyEngine';

class MockLLMAdapter implements LLMAdapter {
  constructor(public responseContent: string) {}
  async generate() {
    return { content: this.responseContent };
  }
}

describe('FlowEngine', () => {
  it('runs a single-step respond action successfully', async () => {
    const validJson = JSON.stringify({
      intent: 'respond',
      confidence: 1,
      proposedAction: { type: 'send_message', payload: { message: 'hello' } }
    });
    const executor = new ActionExecutor(new SkillRegistry());
    executor.execute = async () => ({ success: true, message: 'hello' });

    const flowEngine = new FlowEngine(
      new InMemoryEventLog(),
      new StateResolver(),
      new ContextBuilder(),
      new PromptBuilder(),
      new MockLLMAdapter(validJson),
      new DecisionParser(),
      new PolicyEngine(),
      executor,
      undefined,
      {
        maxSteps: 1,
        maxToolCalls: 1,
        stopOnPolicyRejection: true,
        stopOnToolError: true,
        allowRetries: false,
        maxRetries: 0
      }
    );

    const result = await flowEngine.run({
      input: 'hello',
      eventId: 'evt-123'
    });

    expect(result.success).toBe(true);
    expect(result.trace?.steps.length).toBe(1);
    expect(result.trace?.steps[0]!.actionType).toBe('send_message');
  });

  it('runs tool execution and synthetic message generation', async () => {
    const toolJson = JSON.stringify({
      intent: 'unknown',
      confidence: 1,
      proposedAction: { type: 'read_file', payload: { path: 'test.txt' } }
    });
    
    const executor = new ActionExecutor(new SkillRegistry());
    executor.execute = async (decision) => {
      if (decision.proposedAction?.type === 'read_file') {
        return { success: true, message: 'read ok', data: { content: 'test content' } };
      }
      return { success: true, message: 'synthetic message' };
    };

    const flowEngine = new FlowEngine(
      new InMemoryEventLog(),
      new StateResolver(),
      new ContextBuilder(),
      new PromptBuilder(),
      new MockLLMAdapter(toolJson),
      new DecisionParser(),
      new PolicyEngine(),
      executor,
      undefined,
      {
        maxSteps: 2,
        maxToolCalls: 1,
        stopOnPolicyRejection: true,
        stopOnToolError: true,
        allowRetries: false,
        maxRetries: 0
      }
    );

    const result = await flowEngine.run({
      input: 'read test.txt',
      eventId: 'evt-123'
    });

    expect(result.success).toBe(true);
    expect(result.trace?.steps.length).toBe(2);
    expect(result.trace?.steps[0]!.actionType).toBe('read_file');
    expect(result.trace?.steps[1]!.actionType).toBe('send_message');
  });
});
