import { Skill } from './Skill';
import { SkillResult } from './SkillResult';

export class AskClarificationSkill implements Skill {
  public readonly name = 'AskClarificationSkill';
  public readonly description = 'A core skill to ask the user for missing information.';

  public canHandle(actionType: string): boolean {
    return actionType === 'ask_clarification';
  }

  public execute(input: unknown): SkillResult {
    if (!input || typeof input !== 'object') {
      return {
        success: false,
        error: 'Invalid input payload: expected object'
      };
    }

    const payload = input as Record<string, unknown>;

    if (typeof payload.question !== 'string' || payload.question.trim() === '') {
      return {
        success: false,
        error: 'ask_clarification requires a non-empty question'
      };
    }

    if (payload.missingFields !== undefined) {
      if (!Array.isArray(payload.missingFields) || !payload.missingFields.every(field => typeof field === 'string')) {
        return {
          success: false,
          error: 'missingFields must be a string array'
        };
      }
    }

    const data: Record<string, unknown> = {
      question: payload.question
    };

    if (payload.missingFields !== undefined) {
      data.missingFields = payload.missingFields;
    }

    return {
      success: true,
      message: payload.question,
      data
    };
  }
}
