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
    private readonly flowConfig?: FlowConfig
  ) {}

  public async run(input: FlowRunInput): Promise<FlowRunResult> {
    const trace = new ExecutionTrace();
    try {
      const maxSteps = this.flowConfig?.maxSteps ?? 2;
      let stepCount = 0;
      let ephemeralStepContext: { actionType: string; message?: string; data?: unknown } | undefined;
      let lastResult: SkillResult | undefined;
      let lastDecision: Decision | undefined;
      let lastState: State | undefined;
      let accumulatedData: any = undefined;

      while (stepCount < maxSteps) {
        stepCount++;
        const events = this.eventLog.getAll();
        lastState = this.stateResolver.resolve(events);

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
          messages: [{ role: 'system', content: prompt }]
        });

        lastDecision = this.decisionParser.parse(llmResult.content);

        const actionType = lastDecision.proposedAction?.type || 'unknown';
        const agentStep: AgentStep = {
          id: `step-${Date.now()}`,
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
            success: false,
            decision: lastDecision,
            state: lastState,
            policyReason: policyDecision.reason || 'Action rejected by policy engine.',
            trace: { steps: trace.getSteps(), results: trace.getResults(), success: trace.isSuccessful() }
          };
        }

        const actionResult = await this.actionExecutor.execute(lastDecision);
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

          if (actionType !== 'send_message' && actionType !== 'none') {
            accumulatedData = { ...accumulatedData, ...actionResult.data };
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
          return {
            success: false,
            result: actionResult,
            decision: lastDecision,
            state: lastState,
            error: actionResult.error,
            trace: { steps: trace.getSteps(), results: trace.getResults(), success: trace.isSuccessful() }
          };
        }

        if (actionType === 'send_message' || actionType === 'none') {
          return {
            success: true,
            result: accumulatedData ? { ...actionResult, data: { ...actionResult.data, ...accumulatedData } } : actionResult,
            decision: lastDecision,
            state: lastState,
            trace: { steps: trace.getSteps(), results: trace.getResults(), success: trace.isSuccessful() }
          };
        }

        if (stepCount >= maxSteps) {
          return {
            success: true,
            result: accumulatedData ? { ...actionResult, data: { ...actionResult.data, ...accumulatedData } } : actionResult,
            decision: lastDecision,
            state: lastState,
            trace: { steps: trace.getSteps(), results: trace.getResults(), success: trace.isSuccessful() }
          };
        }

        // Tool action succeeded and is not terminal.
        ephemeralStepContext = {
          actionType,
          message: actionResult.message,
          data: actionResult.data
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
