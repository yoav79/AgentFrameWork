import { EventLog } from './EventLog';
import { Event } from './Event';
import { FrameworkError } from '../errors/FrameworkError';

export class InMemoryEventLog implements EventLog {
  private events: Event<unknown>[] = [];

  public append(event: Event<unknown>): void {
    if (!event.id) {
      throw new FrameworkError('VALIDATION_ERROR', 'Event must have an id');
    }
    if (!event.type) {
      throw new FrameworkError('VALIDATION_ERROR', 'Event must have a type');
    }
    if (!event.source) {
      throw new FrameworkError('VALIDATION_ERROR', 'Event must have a source');
    }
    if (!event.timestamp) {
      throw new FrameworkError('VALIDATION_ERROR', 'Event must have a timestamp');
    }
    if (event.payload === undefined) {
      throw new FrameworkError('VALIDATION_ERROR', 'Event must have a payload');
    }

    this.events.push(event);
  }

  public getAll(): Event<unknown>[] {
    return [...this.events];
  }
}
