import { Skill } from './Skill';
import { SkillResult } from './SkillResult';

export class NoneSkill implements Skill {
  public readonly name = 'none';
  public readonly description = 'A core skill representing explicit inaction when no task, question, or response is needed.';

  public canHandle(actionType: string): boolean {
    return actionType === 'none';
  }

  public execute(input: unknown): SkillResult {
    return {
      success: true,
      message: 'No action required.'
    };
  }
}
