import { Event } from './Event';

export interface EventLog {
  append(event: Event<unknown>): void;
  getAll(): Event<unknown>[];
}
