import { describe, it, expect } from 'vitest';
import { SendMessageSkill } from '../../../core/skills/SendMessageSkill';

describe('SendMessageSkill', () => {
  it('should handle send_message actionType', () => {
    const skill = new SendMessageSkill();
    expect(skill.canHandle('send_message')).toBe(true);
  });

  it('should not handle none actionType', () => {
    const skill = new SendMessageSkill();
    expect(skill.canHandle('none')).toBe(false);
    expect(skill.canHandle('other')).toBe(false);
  });

  it('should return success when input has a valid message', () => {
    const skill = new SendMessageSkill();
    const result = skill.execute({ message: 'hello' });
    expect(result.success).toBe(true);
    expect(result.message).toBe('hello');
  });

  it('should return failure when input is invalid or empty', () => {
    const skill = new SendMessageSkill();
    
    expect(skill.execute({}).success).toBe(false);
    expect(skill.execute(null).success).toBe(false);
    expect(skill.execute({ message: 123 }).success).toBe(false);
    expect(skill.execute({ message: '' }).success).toBe(false);
  });
});
