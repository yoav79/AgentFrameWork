import { describe, it, expect } from 'vitest';
import { NoneSkill } from '../../../core/skills/NoneSkill';

describe('NoneSkill', () => {
  it('should handle none actionType', () => {
    const skill = new NoneSkill();
    expect(skill.canHandle('none')).toBe(true);
  });

  it('should not handle send_message actionType', () => {
    const skill = new NoneSkill();
    expect(skill.canHandle('send_message')).toBe(false);
    expect(skill.canHandle('other')).toBe(false);
  });

  it('should return success and default message', () => {
    const skill = new NoneSkill();
    const result = skill.execute({});
    expect(result.success).toBe(true);
    expect(result.message).toBe('No action required.');
  });

  it('should ignore any payload without failing', () => {
    const skill = new NoneSkill();
    const result = skill.execute({ someField: 123, list: ['abc'] });
    expect(result.success).toBe(true);
    expect(result.message).toBe('No action required.');
  });
});
