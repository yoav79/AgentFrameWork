import { describe, it, expect } from 'vitest';
import { ActionExecutor } from '../../../core/flow/ActionExecutor';
import { SkillRegistry } from '../../../core/skills/SkillRegistry';
import { Skill } from '../../../core/skills/Skill';
import { SkillResult } from '../../../core/skills/SkillResult';
import { Decision } from '../../../core/schemas/Decision';

class SyncSkill implements Skill {
  name = 'SyncSkill';
  description = 'desc';
  canHandle(type: string) { return type === 'sync_action'; }
  execute(input: unknown): SkillResult {
    return { success: true, data: { payloadReceived: input } };
  }
}

class AsyncSkill implements Skill {
  name = 'AsyncSkill';
  description = 'desc';
  canHandle(type: string) { return type === 'async_action'; }
  async execute(input: unknown): Promise<SkillResult> {
    return { success: true, message: 'async done', data: { payloadReceived: input } };
  }
}

class ThrowingSkill implements Skill {
  name = 'ThrowingSkill';
  description = 'desc';
  canHandle(type: string) { return type === 'throw_action'; }
  execute(): SkillResult {
    throw new Error('Kaboom!');
  }
}

describe('ActionExecutor', () => {
  it('should return controlled success when action type is none', async () => {
    const registry = new SkillRegistry();
    const executor = new ActionExecutor(registry);
    
    const decision: Decision = {
      intent: 'unknown',
      confidence: 1,
      proposedAction: { type: 'none' }
    };

    const result = await executor.execute(decision);
    expect(result.success).toBe(true);
    expect(result.message).toContain('No action required');
  });

  it('should return error when no compatible skill is found', async () => {
    const registry = new SkillRegistry();
    const executor = new ActionExecutor(registry);
    
    const decision: Decision = {
      intent: 'respond',
      confidence: 1,
      proposedAction: { type: 'send_message' } // send_message skill not registered here
    };

    const result = await executor.execute(decision);
    expect(result.success).toBe(false);
    expect(result.error).toContain('No compatible skill found');
  });

  it('should execute a synchronous skill and pass the payload', async () => {
    const registry = new SkillRegistry();
    registry.register(new SyncSkill());
    const executor = new ActionExecutor(registry);
    
    const decision: Decision = {
      intent: 'respond',
      confidence: 1,
      proposedAction: { type: 'sync_action', payload: { foo: 'bar' } } as any // bypassing strict union typing for testing
    };

    const result = await executor.execute(decision);
    expect(result.success).toBe(true);
    expect(result.data?.payloadReceived).toEqual({ foo: 'bar' });
  });

  it('should execute an asynchronous skill and pass the payload', async () => {
    const registry = new SkillRegistry();
    registry.register(new AsyncSkill());
    const executor = new ActionExecutor(registry);
    
    const decision: Decision = {
      intent: 'respond',
      confidence: 1,
      proposedAction: { type: 'async_action', payload: { ping: 'pong' } } as any
    };

    const result = await executor.execute(decision);
    expect(result.success).toBe(true);
    expect(result.message).toBe('async done');
    expect(result.data?.payloadReceived).toEqual({ ping: 'pong' });
  });

  it('should capture exceptions from skills and return controlled error', async () => {
    const registry = new SkillRegistry();
    registry.register(new ThrowingSkill());
    const executor = new ActionExecutor(registry);
    
    const decision: Decision = {
      intent: 'respond',
      confidence: 1,
      proposedAction: { type: 'throw_action' } as any
    };

    const result = await executor.execute(decision);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Kaboom!');
  });
});
