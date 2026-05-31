import { EventLog } from '../events/EventLog';
import { EventType } from '../events/EventType';
import { HistoryContext } from './HistoryContext';
import { UserMessageReceivedPayload, ActionExecutedPayload, ActionFailedPayload, PolicyRejectedPayload } from '../events/Event';

export class MemoryReader {
  constructor(private readonly eventLog: EventLog) {}

  public read(options?: { limit?: number }): HistoryContext {
    const limit = options?.limit ?? 20;
    const allEvents = this.eventLog.getAll();
    const recentEvents = allEvents.slice(-limit);

    const context: HistoryContext = {
      recentUserMessages: [],
      recentActions: [],
      recentPolicyRejections: [],
      eventCount: recentEvents.length
    };

    const truncate = (str: string, maxLen: number = 500) => {
      if (!str) return str;
      return str.length > maxLen ? str.substring(0, maxLen) + '...' : str;
    };

    for (const event of recentEvents) {
      if (event.type === EventType.UserMessageReceived) {
        const payload = event.payload as UserMessageReceivedPayload;
        if (payload.message) {
          context.recentUserMessages.push(truncate(payload.message));
        }
      } else if (event.type === EventType.ActionExecuted) {
        const payload = event.payload as ActionExecutedPayload;
        // Only terminal actions (send_message) are meaningful in history.
        // Tool actions (read_file, etc.) are ephemeral — their result lives in
        // ephemeralStepContext for the current turn only. Injecting them here
        // causes the LLM to think the task is already done on subsequent turns.
        if (payload.actionType !== 'send_message') continue;
        context.recentActions.push({
          actionType: truncate(payload.actionType, 100),
          success: true,
          message: payload.message ? truncate(payload.message) : undefined
        });
      } else if (event.type === EventType.ActionFailed) {
        const payload = event.payload as ActionFailedPayload;
        context.recentActions.push({
          actionType: truncate(payload.actionType, 100),
          success: false,
          error: payload.error ? truncate(payload.error) : undefined
        });
      } else if (event.type === EventType.PolicyRejected) {
        const payload = event.payload as PolicyRejectedPayload;
        context.recentPolicyRejections.push({
          reason: truncate(payload.reason),
          actionType: payload.actionType ? truncate(payload.actionType, 100) : undefined,
          confidence: payload.confidence
        });
      }
    }

    return context;
  }
}
