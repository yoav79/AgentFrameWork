import { describe, it, expect } from 'vitest';
import { WorkingMemoryStore } from '../../../core/memory/WorkingMemoryStore';
import { WorkingMemoryEntry } from '../../../core/memory/WorkingMemoryEntry';

describe('WorkingMemoryStore', () => {
  it('saves and retrieves entries', () => {
    const store = new WorkingMemoryStore();
    const entry: WorkingMemoryEntry = {
      id: 'wm-1',
      kind: 'file',
      source: 'a.txt',
      actionType: 'read_file',
      content: 'hello',
      loadedAt: new Date()
    };

    store.set(entry);
    expect(store.has('a.txt')).toBe(true);
    expect(store.get('a.txt')).toEqual(entry);
    expect(store.getAll()).toHaveLength(1);
    expect(store.getAll()[0]).toEqual(entry);
  });

  it('updates entry on duplicate source instead of appending', () => {
    const store = new WorkingMemoryStore();
    const entry1: WorkingMemoryEntry = {
      id: 'wm-1',
      kind: 'file',
      source: 'a.txt',
      actionType: 'read_file',
      content: 'hello',
      loadedAt: new Date()
    };
    const entry2: WorkingMemoryEntry = {
      id: 'wm-2',
      kind: 'file',
      source: 'a.txt',
      actionType: 'read_file',
      content: 'world',
      loadedAt: new Date()
    };

    store.set(entry1);
    store.set(entry2);

    expect(store.getAll()).toHaveLength(1);
    expect(store.get('a.txt')?.content).toBe('world');
  });

  it('returns a shallow copied snapshot', () => {
    const store = new WorkingMemoryStore();
    const entry: WorkingMemoryEntry = {
      id: 'wm-1',
      kind: 'file',
      source: 'a.txt',
      actionType: 'read_file',
      content: 'hello',
      loadedAt: new Date()
    };

    store.set(entry);
    const snap = store.snapshot();
    expect(snap).toHaveLength(1);
    expect(snap[0]).not.toBe(entry); // should be copied
    expect(snap[0]?.id).toBe(entry.id);
  });
});
