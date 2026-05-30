import { Skill } from './Skill';
import { SkillResult } from './SkillResult';

export class SendMessageSkill implements Skill {
  public readonly name = 'SendMessageSkill';
  public readonly description = 'A core skill to return a message to the user.';

  public canHandle(actionType: string): boolean {
    return actionType === 'send_message';
  }

  public execute(input: unknown): SkillResult {
    if (!input || typeof input !== 'object') {
      return {
        success: false,
        error: 'Invalid input payload: expected object'
      };
    }

    const payload = input as Record<string, unknown>;
    
    if (typeof payload.message !== 'string' || payload.message.trim() === '') {
      return {
        success: false,
        error: 'Invalid input payload: missing or empty "message" string'
      };
    }

    return {
      success: true,
      message: payload.message,
      data: { originalPayload: payload }
    };
  }
}
