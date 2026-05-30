import { describe, it, expect } from 'vitest';
import { DecisionParser } from '../../../core/routing/DecisionParser';
import { FrameworkError } from '../../../core/errors/FrameworkError';

describe('DecisionParser', () => {
  it('should parse valid JSON decision', () => {
    const parser = new DecisionParser();
    const raw = JSON.stringify({
      intent: 'respond',
      confidence: 0.9,
      proposedAction: { type: 'send_message' }
    });
    
    const decision = parser.parse(raw);
    expect(decision.intent).toBe('respond');
    expect(decision.confidence).toBe(0.9);
    expect(decision.proposedAction.type).toBe('send_message');
  });

  it('should parse JSON wrapped in markdown fence', () => {
    const parser = new DecisionParser();
    const raw = `\`\`\`json\n{"intent": "unknown", "confidence": 0.5, "proposedAction": {"type": "none"}}\n\`\`\``;
    
    const decision = parser.parse(raw);
    expect(decision.intent).toBe('unknown');
    expect(decision.confidence).toBe(0.5);
    expect(decision.proposedAction.type).toBe('none');
  });

  it('should reject invalid JSON', () => {
    const parser = new DecisionParser();
    const raw = `This is not JSON`;
    
    expect(() => parser.parse(raw)).toThrowError(FrameworkError);
    expect(() => parser.parse(raw)).toThrowError(/Failed to parse raw decision as JSON/);
  });

  it('should reject invalid intent', () => {
    const parser = new DecisionParser();
    const raw = JSON.stringify({
      intent: 'do_something_bad',
      confidence: 0.9,
      proposedAction: { type: 'send_message' }
    });
    
    expect(() => parser.parse(raw)).toThrowError(FrameworkError);
    expect(() => parser.parse(raw)).toThrowError(/Decision must have a valid intent/);
  });

  it('should reject confidence out of range', () => {
    const parser = new DecisionParser();
    const raw = JSON.stringify({
      intent: 'respond',
      confidence: 1.5,
      proposedAction: { type: 'send_message' }
    });
    
    expect(() => parser.parse(raw)).toThrowError(FrameworkError);
    expect(() => parser.parse(raw)).toThrowError(/Decision confidence must be a number between 0 and 1/);
  });

  it('should reject decision without proposedAction.type', () => {
    const parser = new DecisionParser();
    const raw = JSON.stringify({
      intent: 'respond',
      confidence: 0.9,
      proposedAction: { payload: {} }
    });
    
    expect(() => parser.parse(raw)).toThrowError(FrameworkError);
    expect(() => parser.parse(raw)).toThrowError(/Decision must have a valid proposedAction.type/);
  });
});
