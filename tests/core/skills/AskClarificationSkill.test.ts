import { describe, it, expect } from 'vitest';
import { AskClarificationSkill } from '../../../core/skills/AskClarificationSkill';

describe('AskClarificationSkill', () => {
  it('should handle ask_clarification actionType', () => {
    const skill = new AskClarificationSkill();
    expect(skill.canHandle('ask_clarification')).toBe(true);
  });

  it('should not handle send_message actionType', () => {
    const skill = new AskClarificationSkill();
    expect(skill.canHandle('send_message')).toBe(false);
    expect(skill.canHandle('none')).toBe(false);
  });

  it('should return success and message equal to question when input has a valid question', () => {
    const skill = new AskClarificationSkill();
    const result = skill.execute({ question: 'What is your name?' });
    expect(result.success).toBe(true);
    expect(result.message).toBe('What is your name?');
    expect(result.data).toEqual({ question: 'What is your name?' });
  });

  it('should return success and include missingFields when input has valid missingFields', () => {
    const skill = new AskClarificationSkill();
    const result = skill.execute({ question: 'Please provide missing details', missingFields: ['email', 'phone'] });
    expect(result.success).toBe(true);
    expect(result.message).toBe('Please provide missing details');
    expect(result.data).toEqual({
      question: 'Please provide missing details',
      missingFields: ['email', 'phone']
    });
  });

  it('should return failure when question is missing', () => {
    const skill = new AskClarificationSkill();
    const result = skill.execute({});
    expect(result.success).toBe(false);
    expect(result.error).toBe('ask_clarification requires a non-empty question');
  });

  it('should return failure when question is empty', () => {
    const skill = new AskClarificationSkill();
    const result = skill.execute({ question: '   ' });
    expect(result.success).toBe(false);
    expect(result.error).toBe('ask_clarification requires a non-empty question');
  });

  it('should return failure when missingFields is invalid', () => {
    const skill = new AskClarificationSkill();
    const result1 = skill.execute({ question: 'Valid question', missingFields: 'not-an-array' });
    expect(result1.success).toBe(false);
    expect(result1.error).toBe('missingFields must be a string array');

    const result2 = skill.execute({ question: 'Valid question', missingFields: [123, 'valid'] });
    expect(result2.success).toBe(false);
    expect(result2.error).toBe('missingFields must be a string array');
  });
});
