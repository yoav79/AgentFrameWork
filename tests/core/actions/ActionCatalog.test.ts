import { describe, it, expect } from 'vitest';
import { ActionCatalog } from '../../../core/actions/ActionCatalog';
import { PromptBuilder } from '../../../core/context/PromptBuilder';
import { DecisionParser } from '../../../core/routing/DecisionParser';
import { PolicyEngine } from '../../../core/policy/PolicyEngine';
import { BuiltContext } from '../../../core/context/ContextBuilder';
import { getNativeSkillActionTypes, getNativeSkillDefinitions } from '../../../core/skills/NativeSkills';

describe('ActionCatalog integration', () => {
  it('correctly provides actions and properties', () => {
    const types = ActionCatalog.getActionTypes();
    expect(types).toContain('send_message');
    expect(types).toContain('none');
    expect(types).toContain('read_file');
    expect(ActionCatalog.isValidAction('send_message')).toBe(true);
    expect(ActionCatalog.isValidAction('invalid_action')).toBe(false);
    expect(ActionCatalog.isTerminal('send_message')).toBe(true);
    expect(ActionCatalog.isTerminal('read_file')).toBe(false);

    const noneAction = ActionCatalog.getAction('none');
    expect(noneAction).toBeDefined();
    expect(noneAction?.description).toContain('DO NOT use "none" when');
    expect(noneAction?.description).toContain('you MUST use send_message');
  });

  it('feeds dynamic available actions and schema expected to PromptBuilder', () => {
    const promptBuilder = new PromptBuilder();
    const mockContext: BuiltContext = {
      projectId: 'p1',
      sessionId: 's1',
      messageCount: 5,
      lastEventId: 'evt-123',
      updatedAt: new Date(),
      lastUserMessage: 'hello'
    };
    const prompt = promptBuilder.build(mockContext);
    
    // Check that prompt contains catalog action details
    expect(prompt).toContain('send_message');
    expect(prompt).toContain('none');
    expect(prompt).toContain('read_file');
  });

  it('feeds dynamic validation to DecisionParser', () => {
    const parser = new DecisionParser();
    
    // valid actions parsed successfully
    const decision1 = parser.parse(JSON.stringify({
      intent: 'respond',
      confidence: 0.9,
      proposedAction: { type: 'send_message', payload: { message: 'hi' } }
    }));
    expect(decision1.proposedAction.type).toBe('send_message');

    // invalid actions fail validation
    expect(() => parser.parse(JSON.stringify({
      intent: 'respond',
      confidence: 0.9,
      proposedAction: { type: 'invalid_action', payload: {} }
    }))).toThrow(/Decision must have a valid proposedAction.type/);
  });

  it('feeds PolicyEngine configurations', () => {
    const policy = new PolicyEngine();
    
    // read_file requires 0.85 confidence
    const allowedDecision = policy.evaluate({
      intent: 'respond',
      confidence: 0.86,
      proposedAction: { type: 'read_file', payload: { path: 'test.ts' } }
    });
    expect(allowedDecision.allowed).toBe(true);

    const rejectedDecision = policy.evaluate({
      intent: 'respond',
      confidence: 0.84,
      proposedAction: { type: 'read_file', payload: { path: 'test.ts' } }
    });
    expect(rejectedDecision.allowed).toBe(false);
  });

  describe('allowedSkills filtering', () => {
    it('contains all base actions if allowedSkills is undefined', () => {
      const catalog = new ActionCatalog();
      const types = catalog.getActionTypes();
      expect(types).toContain('send_message');
      expect(types).toContain('none');
      expect(types).toContain('ask_clarification');
    });

    it('filters out base actions not in allowedSkills', () => {
      const catalog = new ActionCatalog([], ['send_message']);
      const types = catalog.getActionTypes();
      expect(types).toContain('send_message');
      expect(types).not.toContain('none');
      expect(types).not.toContain('ask_clarification');
    });

    it('can keep ask_clarification only', () => {
      const catalog = new ActionCatalog([], ['ask_clarification']);
      const types = catalog.getActionTypes();
      expect(types).toContain('ask_clarification');
      expect(types).not.toContain('send_message');
      expect(types).not.toContain('none');
    });

    it('can keep none and remove send_message', () => {
      const catalog = new ActionCatalog([], ['none']);
      const types = catalog.getActionTypes();
      expect(types).toContain('none');
      expect(types).not.toContain('send_message');
      expect(types).not.toContain('ask_clarification');
    });

    it('can keep send_message and ask_clarification and remove none', () => {
      const catalog = new ActionCatalog([], ['send_message', 'ask_clarification']);
      const types = catalog.getActionTypes();
      expect(types).toContain('send_message');
      expect(types).toContain('ask_clarification');
      expect(types).not.toContain('none');
    });

    it('can keep all if explicitly provided', () => {
      const catalog = new ActionCatalog([], ['send_message', 'none', 'ask_clarification']);
      const types = catalog.getActionTypes();
      expect(types).toContain('send_message');
      expect(types).toContain('none');
      expect(types).toContain('ask_clarification');
    });
  });

  describe('NativeSkills dynamic synchronization', () => {
    it('should match action types between ActionCatalog and NativeSkills when no filter is applied', () => {
      const catalog = new ActionCatalog();
      const catalogTypes = catalog.getActionTypes();
      
      const nativeActionTypes = getNativeSkillActionTypes();
      
      for (const type of nativeActionTypes) {
        expect(catalogTypes).toContain(type);
      }
    });

    it('should dynamically inherit action definition details from NativeSkills catalog', () => {
      const catalog = new ActionCatalog();
      
      for (const def of getNativeSkillDefinitions()) {
        const actionInCatalog = catalog.getAction(def.actionType);
        expect(actionInCatalog).toBeDefined();
        expect(actionInCatalog?.description).toBe(def.actionDefinition.description);
        expect(actionInCatalog?.isTerminal).toBe(def.actionDefinition.isTerminal);
        expect(actionInCatalog?.minConfidence).toBe(def.actionDefinition.minConfidence);
      }
    });
  });
});
