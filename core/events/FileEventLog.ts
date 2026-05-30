import { EventLog } from './EventLog';
import { Event } from './Event';
import { FrameworkError } from '../errors/FrameworkError';
import * as fs from 'fs';
import * as path from 'path';

export class FileEventLog implements EventLog {
  private events: Event<unknown>[] = [];

  constructor(private readonly filePath: string) {
    this.initialize();
  }

  private initialize(): void {
    if (!fs.existsSync(this.filePath)) {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      this.events = [];
      this.save();
      return;
    }

    try {
      const content = fs.readFileSync(this.filePath, 'utf-8');
      if (!content.trim()) {
        this.events = [];
        return;
      }
      const rawEvents = JSON.parse(content);
      if (!Array.isArray(rawEvents)) {
        throw new FrameworkError('INTERNAL_ERROR', 'FileEventLog JSON must be an array');
      }
      this.events = rawEvents.map((evt: any) => {
        return {
          ...evt,
          timestamp: new Date(evt.timestamp)
        };
      });
    } catch (error) {
      if (error instanceof FrameworkError) {
        throw error;
      }
      throw new FrameworkError('INTERNAL_ERROR', `Failed to load FileEventLog: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private save(): void {
    fs.writeFileSync(this.filePath, JSON.stringify(this.events, null, 2), 'utf-8');
  }

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
    this.save();
  }

  public getAll(): Event<unknown>[] {
    return [...this.events];
  }
}
