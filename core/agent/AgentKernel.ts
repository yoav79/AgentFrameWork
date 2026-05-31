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
import { AgentStep } from '../flow/AgentStep';
import { StepResult } from '../flow/StepResult';
import { FlowConfig, DEFAULT_FLOW_CONFIG } from '../flow/FlowConfig';
import { FlowEngine } from '../flow/FlowEngine';
import { WorkingMemoryStore } from '../memory/WorkingMemoryStore';

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
  private readonly flowEngine: FlowEngine;
  private readonly workingMemoryStore: WorkingMemoryStore;

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
  ) {
    this.workingMemoryStore = new WorkingMemoryStore();
    this.flowEngine = new FlowEngine(
      eventLog,
      stateResolver,
      contextBuilder,
      promptBuilder,
      llmAdapter,
      decisionParser,
      policyEngine,
      actionExecutor,
      memoryReader,
      flowConfig,
      this.workingMemoryStore
    );
  }

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

      const flowResult = await this.flowEngine.run({
        input: input.input,
        projectId: input.projectId,
        sessionId: input.sessionId,
        eventId
      });

      return {
        ...flowResult,
        eventId
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
}
