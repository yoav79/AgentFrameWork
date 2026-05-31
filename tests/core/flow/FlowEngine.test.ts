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

  it('runs tool execution followed by send_message', async () => {
    const json1 = JSON.stringify({
      intent: 'unknown',
      confidence: 1,
      proposedAction: { type: 'read_file', payload: { path: 'test.txt' } }
    });
    const json2 = JSON.stringify({
      intent: 'respond',
      confidence: 1,
      proposedAction: { type: 'send_message', payload: { message: 'synthetic message' } }
    });

    let callCount = 0;
    const llmAdapter = {
      generate: async () => {
        callCount++;
        return { content: callCount === 1 ? json1 : json2 };
      }
    } as any;
    
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
      llmAdapter,
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

  it('fails when maxToolCalls limit is exceeded', async () => {
    const validJson = JSON.stringify({
      intent: 'unknown',
      confidence: 1,
      proposedAction: { type: 'read_file', payload: { path: 'test.txt' } }
    });
    const executor = new ActionExecutor(new SkillRegistry());
    executor.execute = async () => ({ success: true, message: 'read ok' });

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
        maxSteps: 3,
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

    expect(result.success).toBe(false);
    expect(result.error).toBe('Max tool calls exceeded');
  });

  it('stops on tool error when stopOnToolError is true', async () => {
    const validJson = JSON.stringify({
      intent: 'unknown',
      confidence: 1,
      proposedAction: { type: 'read_file', payload: { path: 'test.txt' } }
    });
    const executor = new ActionExecutor(new SkillRegistry());
    executor.execute = async () => ({ success: false, error: 'Disk read failure' });

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
        maxSteps: 2,
        maxToolCalls: 2,
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

    expect(result.success).toBe(false);
    expect(result.error).toBe('Disk read failure');
  });

  it('continues and propagates tool error when stopOnToolError is false', async () => {
    const json1 = JSON.stringify({
      intent: 'unknown',
      confidence: 1,
      proposedAction: { type: 'read_file', payload: { path: 'test.txt' } }
    });
    const json2 = JSON.stringify({
      intent: 'respond',
      confidence: 1,
      proposedAction: { type: 'send_message', payload: { message: 'recovered' } }
    });

    let callCount = 0;
    const llmAdapter = {
      generate: async () => {
        callCount++;
        return { content: callCount === 1 ? json1 : json2 };
      }
    } as any;

    const executor = new ActionExecutor(new SkillRegistry());
    executor.execute = async (decision) => {
      if (decision.proposedAction?.type === 'read_file') {
        return { success: false, error: 'Disk read failure' };
      }
      return { success: true, message: 'recovered' };
    };

    const flowEngine = new FlowEngine(
      new InMemoryEventLog(),
      new StateResolver(),
      new ContextBuilder(),
      new PromptBuilder(),
      llmAdapter,
      new DecisionParser(),
      new PolicyEngine(),
      executor,
      undefined,
      {
        maxSteps: 2,
        maxToolCalls: 2,
        stopOnPolicyRejection: true,
        stopOnToolError: false,
        allowRetries: false,
        maxRetries: 0
      }
    );

    const result = await flowEngine.run({
      input: 'hello',
      eventId: 'evt-123'
    });

    expect(result.success).toBe(true);
    expect(result.result?.message).toBe('recovered');
  });

  it('retries failed actions when allowRetries is true', async () => {
    const validJson = JSON.stringify({
      intent: 'unknown',
      confidence: 1,
      proposedAction: { type: 'read_file', payload: { path: 'test.txt' } }
    });

    let executeCount = 0;
    const executor = new ActionExecutor(new SkillRegistry());
    executor.execute = async () => {
      executeCount++;
      if (executeCount < 3) {
        return { success: false, error: 'temporary fail' };
      }
      return { success: true, message: 'eventual success' };
    };

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
        maxToolCalls: 2,
        stopOnPolicyRejection: true,
        stopOnToolError: true,
        allowRetries: true,
        maxRetries: 2
      }
    );

    const result = await flowEngine.run({
      input: 'hello',
      eventId: 'evt-123'
    });

    expect(executeCount).toBe(3); // 1 initial + 2 retries
    expect(result.success).toBe(false);
    expect(result.error).toBe('Max steps reached without a terminal response');
  });

  it('aborts when stepTimeoutMs is reached', async () => {
    const validJson = JSON.stringify({
      intent: 'respond',
      confidence: 1,
      proposedAction: { type: 'send_message', payload: { message: 'hello' } }
    });
    
    const slowLlmAdapter = {
      generate: async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
        return { content: validJson };
      }
    } as any;

    const executor = new ActionExecutor(new SkillRegistry());
    executor.execute = async () => ({ success: true, message: 'ok' });

    const flowEngine = new FlowEngine(
      new InMemoryEventLog(),
      new StateResolver(),
      new ContextBuilder(),
      new PromptBuilder(),
      slowLlmAdapter,
      new DecisionParser(),
      new PolicyEngine(),
      executor,
      undefined,
      {
        maxSteps: 2,
        maxToolCalls: 2,
        stopOnPolicyRejection: true,
        stopOnToolError: true,
        allowRetries: false,
        maxRetries: 0,
        stepTimeoutMs: 10
      }
    );

    const result = await flowEngine.run({
      input: 'hello',
      eventId: 'evt-123'
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('timed out');
  });
});
