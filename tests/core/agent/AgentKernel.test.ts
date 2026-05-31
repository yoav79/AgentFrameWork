import { describe, it, expect, vi } from 'vitest';
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
import { PolicyEngine } from '../../../core/policy/PolicyEngine';
import { EventType } from '../../../core/events/EventType';
import { MemoryReader } from '../../../core/memory/MemoryReader';
import { HistoryContext } from '../../../core/memory/HistoryContext';

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
    const policyEngine = new PolicyEngine();
    const skillRegistry = new SkillRegistry();
    skillRegistry.register(new MockSkill());
    const actionExecutor = new ActionExecutor(skillRegistry);

    const kernel = new AgentKernel(
      eventLog, stateResolver, contextBuilder, promptBuilder,
      llmAdapter, decisionParser, policyEngine, actionExecutor
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
    
    // Trace assertions
    expect(result.trace).toBeDefined();
    expect(result.trace?.success).toBe(true);
    expect(result.trace?.steps.length).toBe(1);
    expect(result.trace?.results.length).toBe(1);
    expect(result.trace?.steps[0]!.actionType).toBe('send_message');
    expect(result.trace?.results[0]!.success).toBe(true);

    const events = eventLog.getAll();
    expect(events.length).toBe(2);
    expect(events[0]!.type).toBe(EventType.UserMessageReceived);
    expect(events[0]!.payload).toMatchObject({ message: 'hello agent', projectId: 'proj-1' });
    expect(events[1]!.type).toBe(EventType.ActionExecuted);
    expect(events[1]!.payload).toMatchObject({ actionType: 'send_message', success: true });
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
    const policyEngine = new PolicyEngine();
    const actionExecutor = new ActionExecutor(new SkillRegistry()); // Empty registry!

    const kernel = new AgentKernel(
      eventLog, stateResolver, contextBuilder, promptBuilder,
      llmAdapter, decisionParser, policyEngine, actionExecutor
    );

    const result = await kernel.run({ input: 'hello' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('No compatible skill');
    
    expect(result.trace).toBeDefined();
    expect(result.trace?.success).toBe(false);
    expect(result.trace?.steps.length).toBe(1);
    expect(result.trace?.results.length).toBe(1);
    expect(result.trace?.results[0]!.error).toContain('No compatible skill');

    const events = eventLog.getAll();
    expect(events.length).toBe(2);
    expect(events[1]!.type).toBe(EventType.ActionFailed);
    expect(events[1]!.payload).toMatchObject({ actionType: 'send_message' });
  });

  it('should return controlled failure if LLM returns invalid JSON', async () => {
    const eventLog = new InMemoryEventLog();
    const llmAdapter = new MockLLMAdapter('This is not json');
    const actionExecutor = new ActionExecutor(new SkillRegistry());
    const policyEngine = new PolicyEngine();

    const kernel = new AgentKernel(
      eventLog, new StateResolver(), new ContextBuilder(), new PromptBuilder(),
      llmAdapter, new DecisionParser(), policyEngine, actionExecutor
    );

    const result = await kernel.run({ input: 'hello' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Failed to parse raw decision');
  });

  it('should abort execution and return false if policy rejects due to low confidence', async () => {
    const validJson = JSON.stringify({
      intent: 'respond',
      confidence: 0.1,
      proposedAction: { type: 'send_message', payload: { message: 'hello' } }
    });
    
    const llmAdapter = new MockLLMAdapter(validJson);
    const kernel = new AgentKernel(
      new InMemoryEventLog(), new StateResolver(), new ContextBuilder(), new PromptBuilder(),
      llmAdapter, new DecisionParser(), new PolicyEngine(), new ActionExecutor(new SkillRegistry())
    );

    const result = await kernel.run({ input: 'hello' });
    expect(result.success).toBe(false);
    expect(result.policyReason).toContain('below the required threshold');
    expect(result.error).toBeUndefined(); // Should use policyReason, not error
    
    expect(result.trace).toBeDefined();
    expect(result.trace?.success).toBe(false);
    expect(result.trace?.steps.length).toBe(1);
    expect(result.trace?.results.length).toBe(1);
    expect(result.trace?.results[0]!.error).toContain('below the required threshold');

    const events = kernel['eventLog'].getAll();
    expect(events.length).toBe(2);
    expect(events[1]!.type).toBe(EventType.PolicyRejected);
    expect(events[1]!.payload).toMatchObject({ actionType: 'send_message', confidence: 0.1 });
  });

  it('should abort execution and return false if policy rejects due to unknown action', async () => {
    const validJson = JSON.stringify({
      intent: 'respond',
      confidence: 0.9,
      proposedAction: { type: 'format_disk', payload: {} }
    });
    
    const llmAdapter = new MockLLMAdapter(validJson);
    const decisionParser = new DecisionParser();
    // Spy and mock parse to bypass validation for this specific test
    decisionParser.parse = () => JSON.parse(validJson);
    
    const kernel = new AgentKernel(
      new InMemoryEventLog(), new StateResolver(), new ContextBuilder(), new PromptBuilder(),
      llmAdapter, decisionParser, new PolicyEngine(), new ActionExecutor(new SkillRegistry())
    );

    const result = await kernel.run({ input: 'hello' });
    expect(result.success).toBe(false);
    expect(result.policyReason).toContain('is unknown or not permitted');
    expect(result.error).toBeUndefined();
    
    const events = kernel['eventLog'].getAll();
    expect(events.length).toBe(2);
    expect(events[1]!.type).toBe(EventType.PolicyRejected);
    expect(events[1]!.payload).toMatchObject({ actionType: 'format_disk' });
  });

  it('should use MemoryReader if provided and pass history to ContextBuilder', async () => {
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
    const policyEngine = new PolicyEngine();
    const actionExecutor = new ActionExecutor(new SkillRegistry());

    const mockHistory: HistoryContext = {
      recentUserMessages: ['mocked msg'],
      recentActions: [],
      recentPolicyRejections: [],
      eventCount: 1
    };

    const memoryReader = new MemoryReader(eventLog);
    // Mock the read method
    memoryReader.read = () => mockHistory;

    const kernel = new AgentKernel(
      eventLog, stateResolver, contextBuilder, promptBuilder,
      llmAdapter, decisionParser, policyEngine, actionExecutor, memoryReader
    );

    await kernel.run({ input: 'hello' });
    
    // We check that the prompt string contains the mocked msg, proving integration
    const finalPrompt = kernel['promptBuilder'].build(kernel['contextBuilder'].build(stateResolver.resolve([]), mockHistory));
    expect(finalPrompt).toContain('mocked msg');
  });

  it('should maintain conversational memory in interactive mode (two messages)', async () => {
    const validJson = JSON.stringify({
      intent: 'respond',
      confidence: 1,
      proposedAction: { type: 'send_message', payload: { message: 'hello' } }
    });
    const llmAdapter = new MockLLMAdapter(validJson);
    
    // Replace generate to spy on the prompt being sent to LLM
    const generateSpy = vi.spyOn(llmAdapter, 'generate');

    const kernel = new AgentKernel(
      new InMemoryEventLog(), new StateResolver(), new ContextBuilder(), new PromptBuilder(),
      llmAdapter, new DecisionParser(), new PolicyEngine(), new ActionExecutor(new SkillRegistry()), new MemoryReader(new InMemoryEventLog()) // Wait, memory reader needs the SAME event log
    );
    // Let's re-instantiate properly
    const eventLog = new InMemoryEventLog();
    const memoryReader = new MemoryReader(eventLog);
    const kernelWithMemory = new AgentKernel(
      eventLog, new StateResolver(), new ContextBuilder(), new PromptBuilder(),
      llmAdapter, new DecisionParser(), new PolicyEngine(), new ActionExecutor(new SkillRegistry()), memoryReader
    );

    // Message 1
    await kernelWithMemory.run({ input: 'me llamo Yoab', sessionId: 's1' });

    // Verify first call
    expect(generateSpy).toHaveBeenCalledTimes(1);
    
    // Message 2
    await kernelWithMemory.run({ input: 'como me llamo?', sessionId: 's1' });

    // Verify second call
    expect(generateSpy).toHaveBeenCalledTimes(2);
    
    // Extract the prompt passed to the LLM on the second turn
    const secondCallMessages = (generateSpy.mock.calls as any)[1][0].messages;
    const systemPrompt = secondCallMessages.find((m: any) => m.role === 'system')?.content || '';

    // Verify prompt contains history and the previous message
    expect(systemPrompt).toContain('Recent Memory');
    expect(systemPrompt).toContain('me llamo Yoab');
  });

  it('should sanitize data.content from trace in case of heavy payloads', async () => {
    const validJson = JSON.stringify({
      intent: 'respond',
      confidence: 1,
      proposedAction: { type: 'read_file', payload: { path: 'test.txt' } }
    });
    const llmAdapter = new MockLLMAdapter(validJson);
    const actionExecutor = new ActionExecutor(new SkillRegistry());
    actionExecutor.execute = async () => ({
      success: true,
      message: 'File read successfully',
      data: { path: 'test.txt', content: 'GIANT FILE CONTENT HERE', base64Data: 'dGVzdA==' }
    });

    const kernel = new AgentKernel(
      new InMemoryEventLog(), new StateResolver(), new ContextBuilder(), new PromptBuilder(),
      llmAdapter, new DecisionParser(), new PolicyEngine(), actionExecutor
    );

    // It will hit maxSteps (2) returning read_file result because mock LLM always returns read_file
    const result = await kernel.run({ input: 'read the file' });
    expect(result.success).toBe(true);
    expect(result.trace).toBeDefined();
    
    // Trace must not have content or base64Data
    const traceData = result.trace?.results[0]!.data as any;
    expect(traceData).toBeDefined();
    expect(traceData.path).toBe('test.txt');
    expect(traceData.content).toBeUndefined();
    expect(traceData.base64Data).toBeUndefined();
  });

  it('should execute multi-step flow read_file -> send_message', async () => {
    const json1 = JSON.stringify({
      intent: 'unknown',
      confidence: 1,
      proposedAction: { type: 'read_file', payload: { path: 'test.txt' } }
    });
    const json2 = JSON.stringify({
      intent: 'respond',
      confidence: 1,
      proposedAction: { type: 'send_message', payload: { message: 'I read it' } }
    });

    const llmAdapter = new MockLLMAdapter('');
    const generateSpy = vi.spyOn(llmAdapter, 'generate').mockResolvedValueOnce({ content: json1 }).mockResolvedValueOnce({ content: json2 });

    const actionExecutor = new ActionExecutor(new SkillRegistry());
    actionExecutor.execute = async (decision) => {
      if (decision.proposedAction?.type === 'read_file') {
        return { success: true, message: 'read ok', data: { content: 'hello world' } };
      }
      return { success: true, message: 'I read it' }; // send_message
    };

    const kernel = new AgentKernel(
      new InMemoryEventLog(), new StateResolver(), new ContextBuilder(), new PromptBuilder(),
      llmAdapter, new DecisionParser(), new PolicyEngine(), actionExecutor
    );

    const result = await kernel.run({ input: 'read test.txt' });

    expect(generateSpy).toHaveBeenCalledTimes(2);
    expect(result.success).toBe(true);
    expect(result.result?.message).toBe('I read it');
    
    // Trace length 2
    expect(result.trace?.steps.length).toBe(2);
    expect(result.trace?.results.length).toBe(2);
    expect(result.trace?.steps[0]!.actionType).toBe('read_file');
    expect(result.trace?.steps[1]!.actionType).toBe('send_message');
    
    // Check ephemeral context in second prompt
    const secondCallMessages = (generateSpy.mock.calls as any)[1][0].messages;
    const systemPrompt = secondCallMessages.find((m: any) => m.role === 'system')?.content || '';
    expect(systemPrompt).toContain('Previous Tool Result');
    expect(systemPrompt).toContain('hello world'); // data.content injected!
    
    // Trace sanitized check
    const traceData1 = result.trace?.results[0]!.data as any;
    expect(traceData1?.content).toBeUndefined();
  });

  it('should stop immediately if actionType is none', async () => {
    const validJson = JSON.stringify({
      intent: 'unknown',
      confidence: 1,
      proposedAction: { type: 'none', payload: {} }
    });
    const llmAdapter = new MockLLMAdapter(validJson);
    const generateSpy = vi.spyOn(llmAdapter, 'generate');
    const kernel = new AgentKernel(
      new InMemoryEventLog(), new StateResolver(), new ContextBuilder(), new PromptBuilder(),
      llmAdapter, new DecisionParser(), new PolicyEngine(), new ActionExecutor(new SkillRegistry())
    );

    const result = await kernel.run({ input: 'do nothing' });
    expect(generateSpy).toHaveBeenCalledTimes(1);
    expect(result.success).toBe(true);
    expect(result.trace?.steps.length).toBe(1);
  });

  it('should respect maxSteps (2) if LLM loops', async () => {
    const validJson = JSON.stringify({
      intent: 'unknown',
      confidence: 1,
      proposedAction: { type: 'read_file', payload: { path: 'test.txt' } }
    });
    const llmAdapter = new MockLLMAdapter(validJson);
    const generateSpy = vi.spyOn(llmAdapter, 'generate');
    
    const actionExecutor = new ActionExecutor(new SkillRegistry());
    actionExecutor.execute = async () => ({ success: true, message: 'ok' });

    const kernel = new AgentKernel(
      new InMemoryEventLog(), new StateResolver(), new ContextBuilder(), new PromptBuilder(),
      llmAdapter, new DecisionParser(), new PolicyEngine(), actionExecutor
    );

    const result = await kernel.run({ input: 'read forever' });
    expect(generateSpy).toHaveBeenCalledTimes(2);
    expect(result.success).toBe(true);
    expect(result.trace?.steps.length).toBe(2);
  });
});
