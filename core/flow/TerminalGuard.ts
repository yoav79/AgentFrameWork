import { Decision } from '../schemas/Decision';

export class TerminalGuard {
  /**
   * Generates a terminal fallback Decision when the agent loop fails to produce a terminal response.
   * Does not invoke any LLMs, skills, or tools.
   * 
   * @param reason The explanation for why the fallback is being triggered.
   * @param context Optional additional execution context parameters.
   */
  public createFallbackDecision(
    reason: string,
    context?: { lastResult?: unknown; stepCount?: number }
  ): Decision {
    const baseMessage = 'I completed the available steps but could not produce a final response automatically.';
    
    return {
      intent: 'respond',
      confidence: 1.0,
      proposedAction: {
        type: 'send_message',
        payload: {
          message: baseMessage
        }
      },
      reasoning: `Fallback triggered: ${reason}`
    };
  }
}
