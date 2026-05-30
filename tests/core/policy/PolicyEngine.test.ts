import { describe, it, expect } from 'vitest';
import { PolicyEngine } from '../../../core/policy/PolicyEngine';
import { Decision } from '../../../core/schemas/Decision';

describe('PolicyEngine', () => {
  it('permits send_message with sufficient confidence', () => {
    const engine = new PolicyEngine();
    const decision: Decision = {
      intent: 'respond',
      confidence: 0.8,
      proposedAction: { type: 'send_message', payload: { message: 'hello' } }
    };
    const result = engine.evaluate(decision);
    expect(result.allowed).toBe(true);
    expect(result.severity).toBe('info');
  });

  it('rejects send_message with low confidence', () => {
    const engine = new PolicyEngine();
    const decision: Decision = {
      intent: 'respond',
      confidence: 0.5,
      proposedAction: { type: 'send_message', payload: { message: 'hello' } }
    };
    const result = engine.evaluate(decision);
    expect(result.allowed).toBe(false);
    expect(result.severity).toBe('warning');
    expect(result.reason).toMatch(/below the required threshold/);
  });

  it('permits none regardless of confidence', () => {
    const engine = new PolicyEngine();
    const decision: Decision = {
      intent: 'ignore',
      confidence: 0.1, // very low
      proposedAction: { type: 'none', payload: {} }
    };
    const result = engine.evaluate(decision);
    expect(result.allowed).toBe(true);
    expect(result.severity).toBe('info');
  });

  it('rejects unknown action type with critical severity', () => {
    const engine = new PolicyEngine();
    const decision: Decision = {
      intent: 'delete',
      confidence: 0.9,
      proposedAction: { type: 'delete_files', payload: {} }
    };
    const result = engine.evaluate(decision);
    expect(result.allowed).toBe(false);
    expect(result.severity).toBe('critical');
    expect(result.reason).toMatch(/is unknown or not permitted/);
  });

  it('does not mutate the original decision', () => {
    const engine = new PolicyEngine();
    const decision: Decision = {
      intent: 'respond',
      confidence: 0.8,
      proposedAction: { type: 'send_message', payload: { message: 'hello' } }
    };
    // Freeze object to ensure it is not mutated
    Object.freeze(decision);
    Object.freeze(decision.proposedAction);
    Object.freeze(decision.proposedAction.payload);
    
    expect(() => engine.evaluate(decision)).not.toThrow();
  });
});
