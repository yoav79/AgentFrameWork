import { WorkingMemoryEntry } from './WorkingMemoryEntry';

export class WorkingMemoryStore {
  private entries: Map<string, WorkingMemoryEntry> = new Map();

  public set(entry: WorkingMemoryEntry): void {
    // Key by source (path, URL, etc.) to overwrite duplicates
    this.entries.set(entry.source, entry);
  }

  public get(source: string): WorkingMemoryEntry | undefined {
    return this.entries.get(source);
  }

  public getAll(): WorkingMemoryEntry[] {
    return Array.from(this.entries.values());
  }

  public has(source: string): boolean {
    return this.entries.has(source);
  }

  public clear(): void {
    this.entries.clear();
  }

  public snapshot(): WorkingMemoryEntry[] {
    // Return a shallow copy of the entries array
    return this.getAll().map(entry => ({ ...entry }));
  }
}
