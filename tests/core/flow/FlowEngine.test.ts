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
import { ToolRegistry } from '../../../core/tools/ToolRegistry';
import { WorkingMemoryStore } from '../../../core/memory/WorkingMemoryStore';

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

  it('stores successful tool results in workingMemoryStore and passes snapshot to state', async () => {
    const eventLog = new InMemoryEventLog();
    const stateResolver = new StateResolver();
    const contextBuilder = new ContextBuilder();
    const promptBuilder = new PromptBuilder();
    const decisionParser = new DecisionParser();
    const policyEngine = new PolicyEngine();
    const skillRegistry = new SkillRegistry();
    const toolRegistry = new ToolRegistry();
    
    const mockTool = {
      execute: async () => ({ success: true, message: 'File read', data: { content: 'hello file content' } })
    };
    toolRegistry.getToolForAction = () => mockTool as any;
    const actionExecutor = new ActionExecutor(skillRegistry, toolRegistry);
    const workingMemoryStore = new WorkingMemoryStore();

    let calls = 0;
    const mockLlm = {
      generate: async () => {
        calls++;
        if (calls === 1) {
          return {
            content: JSON.stringify({
              intent: 'respond',
              confidence: 0.9,
              proposedAction: { type: 'read_file', payload: { path: 'a.txt' } }
            })
          };
        }
        return {
          content: JSON.stringify({
            intent: 'respond',
            confidence: 0.9,
            proposedAction: { type: 'send_message', payload: { message: 'Done' } }
          })
        };
      }
    };

    const flowEngine = new FlowEngine(
      eventLog,
      stateResolver,
      contextBuilder,
      promptBuilder,
      mockLlm as any,
      decisionParser,
      policyEngine,
      actionExecutor,
      undefined,
      {
        maxSteps: 3,
        maxToolCalls: 2,
        stopOnPolicyRejection: true,
        stopOnToolError: true,
        allowRetries: false,
        maxRetries: 0
      },
      workingMemoryStore
    );

    const result = await flowEngine.run({
      input: 'please read a.txt',
      eventId: 'evt-1'
    });

    expect(result.success).toBe(true);
    expect(workingMemoryStore.has('a.txt')).toBe(true);
    const entry = workingMemoryStore.get('a.txt');
    expect(entry?.kind).toBe('file');
    expect(entry?.content).toBe('hello file content');
    expect(result.state?.workingMemory).toHaveLength(1);
    expect(result.state?.workingMemory?.[0]?.content).toBe('hello file content');
  });

  it('does not stop on repeated actions when detectRepeatedActions is false (Test A)', async () => {
    const validJson = JSON.stringify({
      intent: 'unknown',
      confidence: 1,
      proposedAction: { type: 'read_file', payload: { path: 'test.txt' } }
    });
    
    let executeCount = 0;
    const executor = new ActionExecutor(new SkillRegistry());
    executor.execute = async () => {
      executeCount++;
      return { success: true, message: 'read ok' };
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
        maxSteps: 2,
        maxToolCalls: 2,
        stopOnPolicyRejection: true,
        stopOnToolError: true,
        allowRetries: false,
        maxRetries: 0,
        detectRepeatedActions: false
      }
    );

    const result = await flowEngine.run({
      input: 'hello',
      eventId: 'evt-123'
    });

    expect(executeCount).toBe(2);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Max steps reached without a terminal response');
  });

  it('stops on repeated action when detectRepeatedActions is true and limit reached (Test B)', async () => {
    const validJson = JSON.stringify({
      intent: 'unknown',
      confidence: 1,
      proposedAction: { type: 'read_file', payload: { path: 'test.txt' } }
    });
    
    let executeCount = 0;
    const executor = new ActionExecutor(new SkillRegistry());
    executor.execute = async () => {
      executeCount++;
      return { success: true, message: 'read ok' };
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
        maxSteps: 3,
        maxToolCalls: 3,
        stopOnPolicyRejection: true,
        stopOnToolError: true,
        allowRetries: false,
        maxRetries: 0,
        detectRepeatedActions: true,
        maxRepeatedActions: 2
      }
    );

    const result = await flowEngine.run({
      input: 'hello',
      eventId: 'evt-123'
    });

    expect(executeCount).toBe(1); // the second one should not be executed
    expect(result.success).toBe(false);
    expect(result.error).toBe('Repeated action detected: read_file');
  });

  it('does not stop when action type is same but payload is different (Test C)', async () => {
    let callCount = 0;
    const llmAdapter = {
      generate: async () => {
        callCount++;
        const path = callCount === 1 ? 'test1.txt' : 'test2.txt';
        return { content: JSON.stringify({
          intent: 'unknown',
          confidence: 1,
          proposedAction: { type: 'read_file', payload: { path } }
        })};
      }
    } as any;
    
    let executeCount = 0;
    const executor = new ActionExecutor(new SkillRegistry());
    executor.execute = async () => {
      executeCount++;
      return { success: true, message: 'read ok' };
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
        stopOnToolError: true,
        allowRetries: false,
        maxRetries: 0,
        detectRepeatedActions: true,
        maxRepeatedActions: 2
      }
    );

    const result = await flowEngine.run({
      input: 'hello',
      eventId: 'evt-123'
    });

    expect(executeCount).toBe(2);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Max steps reached without a terminal response');
  });

  it('does not stop when payload is same but action type is different (Test D)', async () => {
    let callCount = 0;
    const llmAdapter = {
      generate: async () => {
        callCount++;
        const type = callCount === 1 ? 'read_file' : 'send_message';
        return { content: JSON.stringify({
          intent: 'unknown',
          confidence: 1,
          proposedAction: { type, payload: { path: 'test.txt' } }
        })};
      }
    } as any;
    
    let executeCount = 0;
    const executor = new ActionExecutor(new SkillRegistry());
    executor.execute = async () => {
      executeCount++;
      return { success: true, message: 'ok' };
    };

    const policyEngine = {
      evaluate: () => ({ allowed: true, reason: 'ok', severity: 'info' })
    } as any;

    const flowEngine = new FlowEngine(
      new InMemoryEventLog(),
      new StateResolver(),
      new ContextBuilder(),
      new PromptBuilder(),
      llmAdapter,
      new DecisionParser(),
      policyEngine,
      executor,
      undefined,
      {
        maxSteps: 2,
        maxToolCalls: 2,
        stopOnPolicyRejection: true,
        stopOnToolError: true,
        allowRetries: false,
        maxRetries: 0,
        detectRepeatedActions: true,
        maxRepeatedActions: 2
      }
    );

    const result = await flowEngine.run({
      input: 'hello',
      eventId: 'evt-123'
    });

    expect(executeCount).toBe(2);
    expect(result.success).toBe(true);
  });

  it('stops on max consecutive failures when stopOnToolError is false (Test A)', async () => {
    let callCount = 0;
    const llmAdapter = {
      generate: async () => {
        callCount++;
        return { content: JSON.stringify({
          intent: 'unknown',
          confidence: 1,
          proposedAction: { type: 'read_file', payload: { path: `test${callCount}.txt` } }
        })};
      }
    } as any;
    
    let executeCount = 0;
    const executor = new ActionExecutor(new SkillRegistry());
    executor.execute = async () => {
      executeCount++;
      return { success: false, error: 'fail' };
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
        maxSteps: 5,
        maxToolCalls: 5,
        stopOnPolicyRejection: true,
        stopOnToolError: false,
        allowRetries: false,
        maxRetries: 0,
        maxConsecutiveFailures: 2
      }
    );

    const result = await flowEngine.run({
      input: 'hello',
      eventId: 'evt-123'
    });

    expect(executeCount).toBe(2);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Max consecutive failures reached');
  });

  it('resets consecutive failures on success (Test B)', async () => {
    let callCount = 0;
    const llmAdapter = {
      generate: async () => {
        callCount++;
        return { content: JSON.stringify({
          intent: 'unknown',
          confidence: 1,
          proposedAction: { type: 'read_file', payload: { path: `test${callCount}.txt` } }
        })};
      }
    } as any;
    
    let executeCount = 0;
    const executor = new ActionExecutor(new SkillRegistry());
    executor.execute = async () => {
      executeCount++;
      // Sequence: fail, success, fail
      if (executeCount === 2) {
        return { success: true, message: 'ok' };
      }
      return { success: false, error: 'fail' };
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
        maxSteps: 3,
        maxToolCalls: 3,
        stopOnPolicyRejection: true,
        stopOnToolError: false,
        allowRetries: false,
        maxRetries: 0,
        maxConsecutiveFailures: 2
      }
    );

    const result = await flowEngine.run({
      input: 'hello',
      eventId: 'evt-123'
    });

    expect(executeCount).toBe(3);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Max steps reached without a terminal response');
  });

  it('stops immediately on first failure if stopOnToolError is true (Test C)', async () => {
    const validJson = JSON.stringify({
      intent: 'unknown',
      confidence: 1,
      proposedAction: { type: 'read_file', payload: { path: 'test.txt' } }
    });
    
    let executeCount = 0;
    const executor = new ActionExecutor(new SkillRegistry());
    executor.execute = async () => {
      executeCount++;
      return { success: false, error: 'first fail' };
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
        maxSteps: 5,
        maxToolCalls: 5,
        stopOnPolicyRejection: true,
        stopOnToolError: true,
        allowRetries: false,
        maxRetries: 0,
        maxConsecutiveFailures: 2
      }
    );

    const result = await flowEngine.run({
      input: 'hello',
      eventId: 'evt-123'
    });

    expect(executeCount).toBe(1);
    expect(result.success).toBe(false);
    expect(result.error).toBe('first fail');
  });

  it('does not count policy rejection as execution failure (Test D)', async () => {
    let callCount = 0;
    const llmAdapter = {
      generate: async () => {
        callCount++;
        return { content: JSON.stringify({
          intent: 'unknown',
          confidence: 1,
          proposedAction: { type: 'read_file', payload: { path: `test${callCount}.txt` } }
        })};
      }
    } as any;
    
    let executeCount = 0;
    const executor = new ActionExecutor(new SkillRegistry());
    executor.execute = async () => {
      executeCount++;
      return { success: false, error: 'fail' };
    };

    const policyEngine = {
      evaluate: () => ({ allowed: false, reason: 'policy rejected', severity: 'error' })
    } as any;

    const flowEngine = new FlowEngine(
      new InMemoryEventLog(),
      new StateResolver(),
      new ContextBuilder(),
      new PromptBuilder(),
      llmAdapter,
      new DecisionParser(),
      policyEngine,
      executor,
      undefined,
      {
        maxSteps: 2,
        maxToolCalls: 2,
        stopOnPolicyRejection: true,
        stopOnToolError: false,
        allowRetries: false,
        maxRetries: 0,
        maxConsecutiveFailures: 2
      }
    );

    const result = await flowEngine.run({
      input: 'hello',
      eventId: 'evt-123'
    });

    expect(executeCount).toBe(0);
    expect(result.success).toBe(false);
    expect(result.policyReason).toBe('policy rejected');
  });

  it('preserves behavior when requireTerminalAction is false (Test A)', async () => {
    let callCount = 0;
    const llmAdapter = {
      generate: async () => {
        callCount++;
        return { content: JSON.stringify({
          intent: 'unknown',
          confidence: 1,
          proposedAction: { type: 'read_file', payload: { path: `test${callCount}.txt` } }
        })};
      }
    } as any;
    
    let executeCount = 0;
    const executor = new ActionExecutor(new SkillRegistry());
    executor.execute = async () => {
      executeCount++;
      return { success: true, message: 'ok' };
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
        stopOnToolError: true,
        allowRetries: false,
        maxRetries: 0,
        requireTerminalAction: false
      }
    );

    const result = await flowEngine.run({
      input: 'hello',
      eventId: 'evt-123'
    });

    expect(executeCount).toBe(2);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Max steps reached without a terminal response');
  });

  it('generates fallback decision when requireTerminalAction is true and maxSteps reached (Test B)', async () => {
    let callCount = 0;
    const llmAdapter = {
      generate: async () => {
        callCount++;
        return { content: JSON.stringify({
          intent: 'unknown',
          confidence: 1,
          proposedAction: { type: 'read_file', payload: { path: `test${callCount}.txt` } }
        })};
      }
    } as any;
    
    let executeCount = 0;
    const executor = new ActionExecutor(new SkillRegistry());
    executor.execute = async () => {
      executeCount++;
      return { success: true, message: 'ok' };
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
        stopOnToolError: true,
        allowRetries: false,
        maxRetries: 0,
        requireTerminalAction: true
      }
    );

    const result = await flowEngine.run({
      input: 'hello',
      eventId: 'evt-123'
    });

    expect(executeCount).toBe(2);
    expect(result.success).toBe(true);
    expect(result.result?.message).toContain('I completed the available steps but could not produce a final response automatically.');
    expect(result.decision?.proposedAction?.type).toBe('send_message');
  });

  it('does not generate fallback if a terminal action was reached (Test C)', async () => {
    let callCount = 0;
    const llmAdapter = {
      generate: async () => {
        callCount++;
        if (callCount === 1) {
          return { content: JSON.stringify({
            intent: 'unknown',
            confidence: 1,
            proposedAction: { type: 'read_file', payload: { path: `test.txt` } }
          })};
        }
        return { content: JSON.stringify({
          intent: 'respond',
          confidence: 1,
          proposedAction: { type: 'send_message', payload: { message: 'real terminal message' } }
        })};
      }
    } as any;
    
    let executeCount = 0;
    const executor = new ActionExecutor(new SkillRegistry());
    executor.execute = async () => {
      executeCount++;
      return { success: true, message: 'real terminal message' };
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
        stopOnToolError: true,
        allowRetries: false,
        maxRetries: 0,
        requireTerminalAction: true
      }
    );

    const result = await flowEngine.run({
      input: 'hello',
      eventId: 'evt-123'
    });

    expect(executeCount).toBe(2);
    expect(result.success).toBe(true);
    expect(result.result?.message).toBe('real terminal message');
  });

  it('does not turn loop limits or repetitions into terminal success (Test D)', async () => {
    const validJson = JSON.stringify({
      intent: 'unknown',
      confidence: 1,
      proposedAction: { type: 'read_file', payload: { path: 'test.txt' } }
    });
    
    let executeCount = 0;
    const executor = new ActionExecutor(new SkillRegistry());
    executor.execute = async () => {
      executeCount++;
      return { success: true, message: 'read ok' };
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
        maxSteps: 3,
        maxToolCalls: 1, // Will fail on 2nd step before running executor because maxToolCalls=1
        stopOnPolicyRejection: true,
        stopOnToolError: true,
        allowRetries: false,
        maxRetries: 0,
        requireTerminalAction: true
      }
    );

    const result = await flowEngine.run({
      input: 'hello',
      eventId: 'evt-123'
    });

    expect(executeCount).toBe(1);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Max tool calls exceeded');
  });
});
