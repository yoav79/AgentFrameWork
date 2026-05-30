import { Event, EventType, UserMessageReceivedPayload } from '../events';
import { State } from './State';

export class StateResolver {
  public resolve(events: Event<unknown>[]): State {
    const state: State = {
      messageCount: 0
    };

    for (const event of events) {
      if (event.type === EventType.UserMessageReceived) {
        const payload = event.payload as UserMessageReceivedPayload;
        state.lastUserMessage = payload.message;
        state.messageCount++;
        
        if (payload.projectId !== undefined) {
          state.projectId = payload.projectId;
        }
        
        if (payload.sessionId !== undefined) {
          state.sessionId = payload.sessionId;
        }
      }

      state.lastEventId = event.id;
      state.updatedAt = event.timestamp;
    }

    return state;
  }
}
