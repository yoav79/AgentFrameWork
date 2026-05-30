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
    private readonly memoryReader?: MemoryReader
  ) {}

  public async run(input: AgentRunInput): Promise<AgentRunResult> {
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

      const events = this.eventLog.getAll();
      const state = this.stateResolver.resolve(events);

      let history;
      if (this.memoryReader) {
        try {
          history = this.memoryReader.read();
        } catch (e) {
          // Tolerancia a fallos: degradación sin memoria
          console.warn('MemoryReader failed, proceeding without history', e);
        }
      }

      const context = this.contextBuilder.build(state, history);
      const prompt = this.promptBuilder.build(context);

      const llmResult = await this.llmAdapter.generate({
        messages: [{ role: 'system', content: prompt }]
      });

      const decision = this.decisionParser.parse(llmResult.content);
      
      const policyDecision = this.policyEngine.evaluate(decision);
      if (!policyDecision.allowed) {
        this.eventLog.append({
          id: `evt-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          type: EventType.PolicyRejected,
          source: EventSource.SYSTEM,
          timestamp: new Date(),
          payload: {
            reason: policyDecision.reason || 'Action rejected by policy engine.',
            severity: policyDecision.severity,
            actionType: decision.proposedAction?.type,
            confidence: decision.confidence
          }
        });

        return {
          success: false,
          decision,
          state,
          eventId,
          policyReason: policyDecision.reason || 'Action rejected by policy engine.'
        };
      }

      const actionResult = await this.actionExecutor.execute(decision);
      
      if (actionResult.success) {
        this.eventLog.append({
          id: `evt-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          type: EventType.ActionExecuted,
          source: EventSource.SYSTEM,
          timestamp: new Date(),
          payload: {
            actionType: decision.proposedAction?.type || 'unknown',
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
            actionType: decision.proposedAction?.type || 'unknown',
            error: actionResult.error || 'Action execution failed'
          }
        });
      }

      return {
        success: actionResult.success,
        result: actionResult,
        decision,
        state,
        eventId,
        ...(actionResult.error ? { error: actionResult.error } : {})
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
}
