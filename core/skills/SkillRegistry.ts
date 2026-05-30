import { Skill } from './Skill';
import { FrameworkError } from '../errors/FrameworkError';

export class SkillRegistry {
  private skills: Map<string, Skill> = new Map();

  public register(skill: Skill): void {
    if (this.skills.has(skill.name)) {
      throw new FrameworkError('REGISTRY_ERROR', `Skill with name '${skill.name}' is already registered.`);
    }
    this.skills.set(skill.name, skill);
  }

  public getSkillForAction(actionType: string): Skill | undefined {
    for (const skill of this.skills.values()) {
      if (skill.canHandle(actionType)) {
        return skill;
      }
    }
    return undefined;
  }

  public getRegisteredSkills(): Skill[] {
    return Array.from(this.skills.values());
  }
}
