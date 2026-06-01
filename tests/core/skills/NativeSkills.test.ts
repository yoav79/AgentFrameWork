import { describe, it, expect } from 'vitest';
import {
  getNativeSkillDefinitions,
  getNativeSkillActionTypes,
  getNativeSkillDefinition
} from '../../../core/skills/NativeSkills';

describe('NativeSkills Catalog', () => {
  it('should contain the three native system skills', () => {
    const types = getNativeSkillActionTypes();
    expect(types).toContain('send_message');
    expect(types).toContain('ask_clarification');
    expect(types).toContain('none');
    expect(types.length).toBe(3);
  });

  it('should retrieve definitions by actionType', () => {
    const sendMsgDef = getNativeSkillDefinition('send_message');
    expect(sendMsgDef).toBeDefined();
    expect(sendMsgDef?.actionType).toBe('send_message');
    expect(sendMsgDef?.actionDefinition.type).toBe('send_message');

    const invalidDef = getNativeSkillDefinition('invalid_type');
    expect(invalidDef).toBeUndefined();
  });

  it('should validate details for each registered native skill', () => {
    const definitions = getNativeSkillDefinitions();
    expect(definitions.length).toBe(3);

    for (const def of definitions) {
      // Each class can be instantiated
      const skillInstance = new def.skillClass();
      expect(skillInstance).toBeDefined();

      // canHandle matches actionType
      expect(skillInstance.canHandle(def.actionType)).toBe(true);
      expect(skillInstance.canHandle('some_other_random_type')).toBe(false);

      // actionDefinition matches type
      expect(def.actionDefinition.type).toBe(def.actionType);

      // description is non-empty string
      expect(typeof def.actionDefinition.description).toBe('string');
      expect(def.actionDefinition.description.trim().length).toBeGreaterThan(0);

      // isTerminal is boolean
      expect(typeof def.actionDefinition.isTerminal).toBe('boolean');

      // minConfidence is number
      expect(typeof def.actionDefinition.minConfidence).toBe('number');
      expect(def.actionDefinition.minConfidence).toBeGreaterThanOrEqual(0);
      expect(def.actionDefinition.minConfidence).toBeLessThanOrEqual(1);
    }
  });
});
