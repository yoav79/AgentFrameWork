import * as fs from 'fs';
import * as path from 'path';
import { EventLog } from '../events/EventLog';
import { EventType, EventSource } from '../events';
import { StateResolver } from '../state/StateResolver';
import { ContextBuilder } from '../context/ContextBuilder';
import { PromptBuilder } from '../context/PromptBuilder';
import { LLMAdapter } from '../llm/LLMAdapter';
import { DecisionParser } from '../routing/DecisionParser';
import { ActionExecutor } from '../flow/ActionExecutor';
import { Decision } from '../schemas/Decision';
import { SkillResult } from '../skills/SkillResult';
import { State } from '../state/State';
import { PolicyEngine } from '../policy/PolicyEngine';
import { MemoryReader } from '../memory/MemoryReader';
import { ExecutionTrace } from '../flow/ExecutionTrace';
import { AgentStep } from '../flow/AgentStep';
import { StepResult } from '../flow/StepResult';
import { ResultSanitizer } from '../flow/ResultSanitizer';
import { FlowConfig } from '../flow/FlowConfig';
import { ActionCatalog } from '../actions/ActionCatalog';
import { WorkingMemoryStore } from '../memory/WorkingMemoryStore';

export interface FlowRunInput {
  input: string;
  projectId?: string;
  sessionId?: string;
  eventId: string;
}

export interface FlowRunResult {
  success: boolean;
  result?: SkillResult;
  decision?: Decision;
  state?: State;
  error?: string;
  policyReason?: string;
  trace?: {
    steps: AgentStep[];
    results: StepResult[];
    success: boolean;
  };
}

export class FlowEngine {
  constructor(
    private readonly eventLog: EventLog,
    private readonly stateResolver: StateResolver,
    private readonly contextBuilder: ContextBuilder,
    private readonly promptBuilder: PromptBuilder,
    private readonly llmAdapter: LLMAdapter,
    private readonly decisionParser: DecisionParser,
    private readonly policyEngine: PolicyEngine,
    private readonly actionExecutor: ActionExecutor,
    private readonly memoryReader?: MemoryReader,
    private readonly flowConfig?: FlowConfig,
    private readonly workingMemoryStore?: WorkingMemoryStore,
    private readonly actionCatalog?: ActionCatalog
  ) {}

  public async run(input: FlowRunInput): Promise<FlowRunResult> {
    const trace = new ExecutionTrace();
    try {
      const maxSteps = this.flowConfig?.maxSteps ?? 2;
      let stepCount = 0;
      let toolCallCount = 0;
      let ephemeralStepContext: { actionType: string; message?: string; data?: unknown } | undefined;
      let lastResult: SkillResult | undefined;
      let lastDecision: Decision | undefined;
      let lastState: State | undefined;
      let accumulatedData: any = undefined;

      while (stepCount < maxSteps) {
        stepCount++;

        const stepPromise = (async () => {
          const events = this.eventLog.getAll();
          lastState = this.stateResolver.resolve(events);
          if (this.workingMemoryStore) {
            lastState.workingMemory = this.workingMemoryStore.snapshot();
          }

          let history;
          if (this.memoryReader) {
            try {
              history = this.memoryReader.read({
                sessionId: input.sessionId,
                projectId: input.projectId
              });
            } catch (e) {
              console.warn('MemoryReader failed, proceeding without history', e);
            }
          }

          const context = this.contextBuilder.build(lastState, history, ephemeralStepContext);
          const prompt = this.promptBuilder.build(context);

          const llmResult = await this.llmAdapter.generate({
            messages: [
              { role: 'system', content: prompt },
              { role: 'user', content: lastState?.lastUserMessage || input.input }
            ]
          });

          lastDecision = this.decisionParser.parse(llmResult.content);

          const actionType = lastDecision.proposedAction?.type || 'unknown';
          const agentStep: AgentStep = {
            id: `step-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
            actionType,
            decision: lastDecision,
            startedAt: new Date()
          };
          trace.addStep(agentStep);

          const policyDecision = this.policyEngine.evaluate(lastDecision);
          if (!policyDecision.allowed) {
            agentStep.endedAt = new Date();
            agentStep.success = false;
            agentStep.error = policyDecision.reason;

            trace.addResult({
              step: agentStep,
              success: false,
              error: policyDecision.reason
            });

            this.eventLog.append({
              id: `evt-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
              type: EventType.PolicyRejected,
              source: EventSource.SYSTEM,
              timestamp: new Date(),
              payload: {
                reason: policyDecision.reason || 'Action rejected by policy engine.',
                severity: policyDecision.severity,
                actionType,
                confidence: lastDecision.confidence,
                runId: input.eventId,
                stepId: agentStep.id,
                sessionId: input.sessionId,
                projectId: input.projectId
              }
            });

            return {
              shouldStop: true,
              result: {
                success: false,
                decision: lastDecision,
                state: lastState,
                policyReason: policyDecision.reason || 'Action rejected by policy engine.',
                trace: { steps: trace.getSteps(), results: trace.getResults(), success: trace.isSuccessful() }
              }
            };
          }

          // Check terminal behavior and limits
          const isTerminal = this.actionCatalog ? this.actionCatalog.isTerminal(actionType) : ActionCatalog.isTerminal(actionType);
          if (!isTerminal) {
            const maxToolCalls = this.flowConfig?.maxToolCalls ?? 1;
            if (toolCallCount >= maxToolCalls) {
              agentStep.endedAt = new Date();
              agentStep.success = false;
              agentStep.error = 'Max tool calls exceeded';

              trace.addResult({
                step: agentStep,
                success: false,
                error: 'Max tool calls exceeded'
              });

              return {
                shouldStop: true,
                result: {
                  success: false,
                  decision: lastDecision,
                  state: lastState,
                  error: 'Max tool calls exceeded',
                  trace: { steps: trace.getSteps(), results: trace.getResults(), success: false }
                }
              };
            }
            toolCallCount++;
          }

          // Execute action with retries
          let actionResult: SkillResult;
          let retryCount = 0;
          const allowRetries = this.flowConfig?.allowRetries ?? false;
          const maxRetries = this.flowConfig?.maxRetries ?? 0;

          while (true) {
            actionResult = await this.actionExecutor.execute(lastDecision);
            if (actionResult.success || !allowRetries || retryCount >= maxRetries) {
              break;
            }
            retryCount++;
          }

          lastResult = actionResult;
          agentStep.endedAt = new Date();
          agentStep.success = actionResult.success;
          if (!actionResult.success) {
            agentStep.error = actionResult.error;
          }

          const sanitizedData = ResultSanitizer.sanitizeData(actionResult.data);
          trace.addResult({
            step: agentStep,
            success: actionResult.success,
            message: actionResult.message,
            error: actionResult.error,
            data: sanitizedData
          });

          if (actionResult.success) {
            this.eventLog.append({
              id: `evt-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
              type: EventType.ActionExecuted,
              source: EventSource.SYSTEM,
              timestamp: new Date(),
              payload: {
                actionType,
                success: true,
                message: actionResult.message,
                runId: input.eventId,
                stepId: agentStep.id,
                sessionId: input.sessionId,
                projectId: input.projectId
              }
            });

            if (!isTerminal) {
              accumulatedData = { ...accumulatedData, ...actionResult.data };

              if (this.workingMemoryStore) {
                const payload = lastDecision.proposedAction?.payload as any;
                const source = payload?.path
                  ?? payload?.url
                  ?? payload?.command
                  ?? actionType;

                const kind = actionType === 'read_file' ? 'file' as const : 'tool_result' as const;

                this.workingMemoryStore.set({
                  id: `wm-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
                  kind,
                  source,
                  actionType,
                  content: typeof actionResult.data === 'object' && actionResult.data !== null
                    ? (actionResult.data as any).content
                    : undefined,
                  data: actionResult.data,
                  metadata: { message: actionResult.message },
                  loadedAt: new Date()
                });
              }
            }
          } else {
            this.eventLog.append({
              id: `evt-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
              type: EventType.ActionFailed,
              source: EventSource.SYSTEM,
              timestamp: new Date(),
              payload: {
                actionType,
                error: actionResult.error || 'Action execution failed',
                runId: input.eventId,
                stepId: agentStep.id,
                sessionId: input.sessionId,
                projectId: input.projectId
              }
            });

            const stopOnToolError = this.flowConfig?.stopOnToolError ?? true;
            if (stopOnToolError) {
              return {
                shouldStop: true,
                result: {
                  success: false,
                  result: actionResult,
                  decision: lastDecision,
                  state: lastState,
                  error: actionResult.error,
                  trace: { steps: trace.getSteps(), results: trace.getResults(), success: trace.isSuccessful() }
                }
              };
            }
          }

          if (isTerminal) {
            let finalResult = actionResult;
            if (actionType === 'none') {
              const successfulTools = trace.getResults().filter(r => r.success && r.step.actionType !== 'none');
              if (successfulTools.length > 0) {
                const messages = successfulTools.map(t => t.message).filter(Boolean);
                finalResult = {
                  ...actionResult,
                  message: `Task completed successfully:\n${messages.map(m => `- ${m}`).join('\n')}`
                };
              }
            }
            return {
              shouldStop: true,
              result: {
                success: true,
                result: accumulatedData ? { ...finalResult, data: { ...finalResult.data, ...accumulatedData } } : finalResult,
                decision: lastDecision,
                state: lastState,
                trace: { steps: trace.getSteps(), results: trace.getResults(), success: trace.isSuccessful() }
              }
            };
          }

          // Non-terminal action (tool execution) failed or succeeded
          if (!actionResult.success) {
            ephemeralStepContext = {
              actionType,
              message: actionResult.error || 'Action execution failed',
              data: { error: actionResult.error || 'Action execution failed' }
            };
          } else {
            ephemeralStepContext = {
              actionType,
              message: actionResult.message,
              data: actionResult.data
            };
          }

          return { shouldStop: false };
        })();

        // Wrap step execution in timeout if stepTimeoutMs is specified
        const stepTimeoutMs = this.flowConfig?.stepTimeoutMs;
        let stepResult: { shouldStop: boolean; result?: FlowRunResult };

        if (stepTimeoutMs && stepTimeoutMs > 0) {
          stepResult = await Promise.race([
            stepPromise,
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error(`Step execution timed out after ${stepTimeoutMs} ms`)), stepTimeoutMs)
            )
          ]);
        } else {
          stepResult = await stepPromise;
        }

        if (stepResult.shouldStop && stepResult.result) {
          return stepResult.result;
        }
      }

      // If we exit the loop without hitting shouldStop, it means stepCount reached maxSteps.
      // If the last proposed action was NOT terminal, we must return success: false to signal failure.
      const lastActionType = lastDecision?.proposedAction?.type;
      const isLastTerminal = lastActionType ? (this.actionCatalog ? this.actionCatalog.isTerminal(lastActionType) : ActionCatalog.isTerminal(lastActionType)) : false;

      if (!isLastTerminal) {
        return {
          success: false,
          error: 'Max steps reached without a terminal response',
          result: accumulatedData && lastResult ? { ...lastResult, data: { ...lastResult.data, ...accumulatedData } } : lastResult,
          decision: lastDecision,
          state: lastState,
          trace: { steps: trace.getSteps(), results: trace.getResults(), success: false }
        };
      }

      return {
        success: lastResult ? lastResult.success : false,
        result: accumulatedData && lastResult ? { ...lastResult, data: { ...lastResult.data, ...accumulatedData } } : lastResult,
        decision: lastDecision,
        state: lastState,
        trace: { steps: trace.getSteps(), results: trace.getResults(), success: trace.isSuccessful() }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        trace: { steps: trace.getSteps(), results: trace.getResults(), success: false }
      };
    }
  }
}
