import { SkillResult } from './SkillResult';

export interface Skill {
  name: string;
  description: string;
  canHandle(actionType: string): boolean;
  execute(input: unknown): Promise<SkillResult> | SkillResult;
}
