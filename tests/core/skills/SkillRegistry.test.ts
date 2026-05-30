import { describe, it, expect } from 'vitest';
import { SkillRegistry } from '../../../core/skills/SkillRegistry';
import { Skill } from '../../../core/skills/Skill';
import { SkillResult } from '../../../core/skills/SkillResult';
import { FrameworkError } from '../../../core/errors/FrameworkError';

class MockSkill implements Skill {
  constructor(public name: string, private handleType: string) {}
  description = 'mock';
  canHandle(actionType: string): boolean { return actionType === this.handleType; }
  execute(): SkillResult { return { success: true }; }
}

describe('SkillRegistry', () => {
  it('should register a valid skill', () => {
    const registry = new SkillRegistry();
    const skill = new MockSkill('mock-skill', 'mock_action');
    registry.register(skill);
    expect(registry.getRegisteredSkills()).toHaveLength(1);
  });

  it('should prevent registering duplicates by name', () => {
    const registry = new SkillRegistry();
    const skill1 = new MockSkill('mock-skill', 'action_1');
    const skill2 = new MockSkill('mock-skill', 'action_2');
    registry.register(skill1);
    expect(() => registry.register(skill2)).toThrowError(FrameworkError);
    expect(() => registry.register(skill2)).toThrowError(/already registered/);
  });

  it('should find a skill by action type', () => {
    const registry = new SkillRegistry();
    const skill = new MockSkill('mock-skill', 'mock_action');
    registry.register(skill);
    const found = registry.getSkillForAction('mock_action');
    expect(found).toBe(skill);
  });

  it('should return undefined if no compatible skill is found', () => {
    const registry = new SkillRegistry();
    const skill = new MockSkill('mock-skill', 'mock_action');
    registry.register(skill);
    const found = registry.getSkillForAction('other_action');
    expect(found).toBeUndefined();
  });
});
