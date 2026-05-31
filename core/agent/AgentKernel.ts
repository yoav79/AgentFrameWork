import { EventLog } from '../events/EventLog';
import { EventType, EventSource, UserMessageReceivedPayload } from '../events';
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
import { FlowConfig, DEFAULT_FLOW_CONFIG } from '../flow/FlowConfig';

export interface AgentRunInput {
  input: string;
  projectId?: string;
  sessionId?: string;
}

export interface AgentRunResult {
  success: boolean;
  result?: SkillResult;
  decision?: Decision;
  state?: State;
  eventId?: string;
  error?: string;
  policyReason?: string;
  trace?: {
    steps: AgentStep[];
    results: StepResult[];
    success: boolean;
  };
}

export class AgentKernel {
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
    private readonly flowConfig: FlowConfig = DEFAULT_FLOW_CONFIG
  ) {}

  public async run(input: AgentRunInput): Promise<AgentRunResult> {
    const trace = new ExecutionTrace();
    try {
      const eventId = `evt-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const payload: UserMessageReceivedPayload = {
        message: input.input,
        projectId: input.projectId,
        sessionId: input.sessionId
      };

      this.eventLog.append({
        id: eventId,
        type: EventType.UserMessageReceived,
        source: EventSource.USER,
        timestamp: new Date(),
        payload
      });

      const maxSteps = this.flowConfig.maxSteps;
      let stepCount = 0;
      let ephemeralStepContext: { actionType: string; message?: string; data?: unknown } | undefined;
      let lastResult: SkillResult | undefined;
      let lastDecision: Decision | undefined;
      let lastState: State | undefined;

      while (stepCount < maxSteps) {
        stepCount++;
        const events = this.eventLog.getAll();
        lastState = this.stateResolver.resolve(events);

        let history;
        if (this.memoryReader) {
          try {
            history = this.memoryReader.read();
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
              confidence: lastDecision.confidence
            }
          });

          return {
            success: false,
            decision: lastDecision,
            state: lastState,
            eventId,
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
              message: actionResult.message
            }
          });
        } else {
          this.eventLog.append({
            id: `evt-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            type: EventType.ActionFailed,
            source: EventSource.SYSTEM,
            timestamp: new Date(),
            payload: {
              actionType,
              error: actionResult.error || 'Action execution failed'
            }
          });
          return {
            success: false,
            result: actionResult,
            decision: lastDecision,
            state: lastState,
            eventId,
            error: actionResult.error,
            trace: { steps: trace.getSteps(), results: trace.getResults(), success: trace.isSuccessful() }
          };
        }

        if (actionType === 'send_message' || actionType === 'none') {
          return {
            success: true,
            result: actionResult,
            decision: lastDecision,
            state: lastState,
            eventId,
            trace: { steps: trace.getSteps(), results: trace.getResults(), success: trace.isSuccessful() }
          };
        }

        if (stepCount >= maxSteps) {
          return {
            success: true,
            result: actionResult,
            decision: lastDecision,
            state: lastState,
            eventId,
            trace: { steps: trace.getSteps(), results: trace.getResults(), success: trace.isSuccessful() }
          };
        }

        // Tool action succeeded and is not terminal.
        // Instead of looping back to the LLM (which consistently fails to produce
        // a valid send_message in step 2), the Kernel synthesizes the response
        // directly. The LLM already made the important decision in step 1.
        const toolData = actionResult.data as Record<string, unknown> | undefined;
        const fileContent = toolData?.content as string | undefined;
        const syntheticMessage = fileContent
          ? `${actionResult.message}\n\n${fileContent}`
          : actionResult.message || 'Tool executed successfully.';

        const syntheticDecision: Decision = {
          intent: 'respond',
          confidence: 1.0,
          proposedAction: {
            type: 'send_message',
            payload: { message: syntheticMessage }
          }
        };

        const syntheticResult = await this.actionExecutor.execute(syntheticDecision);

        const syntheticStep: AgentStep = {
          id: `step-${Date.now()}`,
          actionType: 'send_message',
          decision: syntheticDecision,
          startedAt: new Date(),
          endedAt: new Date(),
          success: syntheticResult.success
        };
        trace.addStep(syntheticStep);
        trace.addResult({
          step: syntheticStep,
          success: syntheticResult.success,
          message: syntheticResult.message,
          data: ResultSanitizer.sanitizeData(syntheticResult.data)
        });

        this.eventLog.append({
          id: `evt-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          type: EventType.ActionExecuted,
          source: EventSource.SYSTEM,
          timestamp: new Date(),
          payload: {
            actionType: 'send_message',
            success: true,
            message: syntheticResult.message
          }
        });

        return {
          success: true,
          result: { ...syntheticResult, data: actionResult.data },
          decision: syntheticDecision,
          state: lastState,
          eventId,
          trace: { steps: trace.getSteps(), results: trace.getResults(), success: trace.isSuccessful() }
        };
      }

      return {
        success: lastResult ? lastResult.success : false,
        result: lastResult,
        decision: lastDecision,
        state: lastState,
        eventId,
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
