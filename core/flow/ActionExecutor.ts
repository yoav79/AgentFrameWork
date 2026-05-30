import { Decision } from '../schemas/Decision';
import { SkillRegistry } from '../skills/SkillRegistry';
import { SkillResult } from '../skills/SkillResult';

export class ActionExecutor {
  constructor(private readonly registry: SkillRegistry) {}

  public async execute(decision: Decision): Promise<SkillResult> {
    const actionType = decision.proposedAction.type;

    if (actionType === 'none') {
      return {
        success: true,
        message: 'No action required.'
      };
    }

    const skill = this.registry.getSkillForAction(actionType);

    if (!skill) {
      return {
        success: false,
        error: `No compatible skill found for action type: ${actionType}`
      };
    }

    try {
      const result = await skill.execute(decision.proposedAction.payload);
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: `Skill execution failed: ${errorMessage}`
      };
    }
  }
}
