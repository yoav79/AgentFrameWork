import { describe, it, expect } from 'vitest';
import {
  getCustomSkillDefinitions,
  getCustomSkillActionTypes,
  getCustomSkillDefinition
} from '../../skills/CustomSkills';

describe('CustomSkills Catalog', () => {
  it('getCustomSkillDefinitions() contains validate_required_fields', () => {
    const defs = getCustomSkillDefinitions();
    expect(defs.map(d => d.actionType)).toContain('validate_required_fields');
  });

  it('getCustomSkillActionTypes() contains validate_required_fields', () => {
    const types = getCustomSkillActionTypes();
    expect(types).toContain('validate_required_fields');
  });

  it('getCustomSkillDefinition("validate_required_fields") returns a definition', () => {
    const def = getCustomSkillDefinition('validate_required_fields');
    expect(def).toBeDefined();
    expect(def?.actionType).toBe('validate_required_fields');
  });

  it('actionDefinition.type matches actionType for each skill', () => {
    for (const def of getCustomSkillDefinitions()) {
      expect(def.actionDefinition.type).toBe(def.actionType);
    }
  });

  it('skillClass can be instantiated for each skill', () => {
    for (const def of getCustomSkillDefinitions()) {
      const instance = new def.skillClass();
      expect(instance).toBeDefined();
    }
  });

  it('skillClass.canHandle returns true for its own actionType', () => {
    for (const def of getCustomSkillDefinitions()) {
      const instance = new def.skillClass();
      expect(instance.canHandle(def.actionType)).toBe(true);
    }
  });

  it('getCustomSkillDefinition() returns undefined for unknown actionType', () => {
    expect(getCustomSkillDefinition('missing')).toBeUndefined();
    expect(getCustomSkillDefinition('')).toBeUndefined();
  });

  it('getCustomSkillDefinitions() returns a safe copy (mutation does not affect catalog)', () => {
    const copy = getCustomSkillDefinitions();
    const originalLength = copy.length;
    (copy as object[]).push({ actionType: 'injected' });
    expect(getCustomSkillDefinitions().length).toBe(originalLength);
  });
});

