import { describe, it, expect } from 'vitest';
import { ToolRegistry } from '../../../core/tools/ToolRegistry';
import { Tool } from '../../../core/tools/Tool';
import { ToolResult } from '../../../core/tools/ToolResult';

class DummyTool implements Tool {
  constructor(public name: string, public actionType: string) {}
  description = 'Dummy tool';
  canHandle(type: string) { return type === this.actionType; }
  execute(input: unknown): ToolResult {
    return { success: true, data: input as Record<string, unknown> };
  }
}

class AsyncTool implements Tool {
  name = 'AsyncTool';
  description = 'Async dummy tool';
  canHandle(type: string) { return type === 'async_action'; }
  async execute(input: unknown): Promise<ToolResult> {
    return { success: true, message: 'async done', data: input as Record<string, unknown> };
  }
}

describe('ToolRegistry', () => {
  it('should start empty', () => {
    const registry = new ToolRegistry();
    expect(registry.getRegisteredTools().length).toBe(0);
  });

  it('should register a valid tool', () => {
    const registry = new ToolRegistry();
    const tool = new DummyTool('TestTool', 'test_action');
    registry.register(tool);
    expect(registry.getRegisteredTools().length).toBe(1);
    expect(registry.getRegisteredTools()[0]).toBe(tool);
  });

  it('should reject duplicates by name', () => {
    const registry = new ToolRegistry();
    const tool1 = new DummyTool('TestTool', 'test_action_1');
    const tool2 = new DummyTool('TestTool', 'test_action_2');
    registry.register(tool1);
    
    try {
      registry.register(tool2);
      expect.fail('Should have thrown an error');
    } catch (e: any) {
      expect(e.message).toMatch(/already registered/);
      expect(e.code).toBe('REGISTRY_ERROR');
    }
  });

  it('should find tool by action type using canHandle', () => {
    const registry = new ToolRegistry();
    const tool1 = new DummyTool('Tool1', 'action_1');
    const tool2 = new DummyTool('Tool2', 'action_2');
    registry.register(tool1);
    registry.register(tool2);

    expect(registry.getToolForAction('action_1')).toBe(tool1);
    expect(registry.getToolForAction('action_2')).toBe(tool2);
  });

  it('should return undefined if no tool matches', () => {
    const registry = new ToolRegistry();
    const tool = new DummyTool('Tool', 'action_1');
    registry.register(tool);

    expect(registry.getToolForAction('unknown_action')).toBeUndefined();
  });

  it('should support synchronous tools', () => {
    const registry = new ToolRegistry();
    const tool = new DummyTool('SyncTool', 'sync_action');
    registry.register(tool);

    const found = registry.getToolForAction('sync_action');
    expect(found).toBeDefined();
    
    const result = found!.execute('test') as ToolResult;
    expect(result.success).toBe(true);
    expect(result.data).toBe('test');
  });

  it('should support asynchronous tools', async () => {
    const registry = new ToolRegistry();
    const tool = new AsyncTool();
    registry.register(tool);

    const found = registry.getToolForAction('async_action');
    expect(found).toBeDefined();
    
    const result = await found!.execute('async_test');
    expect(result.success).toBe(true);
    expect(result.message).toBe('async done');
    expect(result.data).toBe('async_test');
  });
});
