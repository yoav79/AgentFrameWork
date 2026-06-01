import { describe, it, expect } from 'vitest';
import { TerminalGuard } from '../../../core/flow/TerminalGuard';

describe('TerminalGuard', () => {
  it('generates a fallback decision with proposedAction type send_message', () => {
    const guard = new TerminalGuard();
    const decision = guard.createFallbackDecision('Max steps reached');
    
    expect(decision.proposedAction.type).toBe('send_message');
    expect(decision.proposedAction.payload?.message).toBe('I completed the available steps but could not produce a final response automatically.');
  });

  it('includes the reason in the reasoning field', () => {
    const guard = new TerminalGuard();
    const reason = 'Max tool calls exceeded';
    const decision = guard.createFallbackDecision(reason);
    
    expect(decision.reasoning).toContain(reason);
  });

  it('returns confidence as a number between 0 and 1', () => {
    const guard = new TerminalGuard();
    const decision = guard.createFallbackDecision('Limit reached');
    
    expect(typeof decision.confidence).toBe('number');
    expect(decision.confidence).toBeGreaterThanOrEqual(0);
    expect(decision.confidence).toBeLessThanOrEqual(1);
  });

  it('returns an intent compatible with Decision schema', () => {
    const guard = new TerminalGuard();
    const decision = guard.createFallbackDecision('Limit reached');
    
    expect(decision.intent).toBe('respond');
  });

  it('generates independent decisions on multiple calls', () => {
    const guard = new TerminalGuard();
    const decision1 = guard.createFallbackDecision('Reason A');
    const decision2 = guard.createFallbackDecision('Reason B');
    
    expect(decision1).not.toBe(decision2);
    expect(decision1.reasoning).toContain('Reason A');
    expect(decision2.reasoning).toContain('Reason B');
  });

  it('does not require lastResult or context parameters', () => {
    const guard = new TerminalGuard();
    const decision = guard.createFallbackDecision('No context');
    
    expect(decision).toBeDefined();
    expect(decision.proposedAction.payload?.message).toBeDefined();
  });

  it('accepts optional context without breaking Decision shape', () => {
    const guard = new TerminalGuard();
    const context = { lastResult: { error: 'something' }, stepCount: 5 };
    const decision = guard.createFallbackDecision('Context provided', context);
    
    expect(decision.proposedAction.type).toBe('send_message');
    expect(decision.proposedAction.payload?.message).toBeDefined();
  });
});
