import { Decision } from '../schemas/Decision';
import { SkillRegistry } from '../skills/SkillRegistry';
import { ToolRegistry } from '../tools/ToolRegistry';
import { ExecutionResult } from './ExecutionResult';

export class ActionExecutor {
  constructor(
    private readonly registry: SkillRegistry,
    private readonly toolRegistry?: ToolRegistry
  ) {}

  public async execute(decision: Decision): Promise<ExecutionResult> {
    const actionType = decision.proposedAction.type;

    const skill = this.registry.getSkillForAction(actionType);

    if (skill) {
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

    if (this.toolRegistry) {
      const tool = this.toolRegistry.getToolForAction(actionType);
      if (tool) {
        try {
          const result = await tool.execute(decision.proposedAction.payload);
          return {
            success: result.success,
            message: result.message,
            data: result.data,
            error: result.error
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          return {
            success: false,
            error: `Tool execution failed: ${errorMessage}`
          };
        }
      }
    }

    return {
      success: false,
      error: `No compatible skill or tool found for action type: ${actionType}`
    };
  }
}
