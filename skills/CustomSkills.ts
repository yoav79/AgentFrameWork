import { Skill } from '../core/skills/Skill';
import { ActionDefinition } from '../core/actions/ActionDefinition';
import { ValidateRequiredFieldsSkill } from './ValidateRequiredFieldsSkill';

export interface CustomSkillDefinition {
  actionType: string;
  skillClass: new () => Skill;
  actionDefinition: ActionDefinition;
}

const CUSTOM_SKILL_DEFINITIONS: CustomSkillDefinition[] = [
  {
    actionType: 'validate_required_fields',
    skillClass: ValidateRequiredFieldsSkill,
    actionDefinition: {
      type: 'validate_required_fields',
      description:
        'Use ONLY when you need to verify that all required fields are present in a data object before proceeding.\n' +
        '   - Payload expected: { "fields": { "key": "value", ... }, "required": ["key1", "key2"] }\n' +
        '   - Returns: { "valid": boolean, "missing": string[] }\n' +
        '   - If valid is false, use ask_clarification to request the missing fields from the user.\n' +
        '   - This action is NOT terminal: continue the flow after receiving the result.',
      isTerminal: false,
      minConfidence: 0.8
    }
  }
];

export function getCustomSkillDefinitions(): CustomSkillDefinition[] {
  return [...CUSTOM_SKILL_DEFINITIONS];
}

export function getCustomSkillActionTypes(): string[] {
  return CUSTOM_SKILL_DEFINITIONS.map(d => d.actionType);
}

export function getCustomSkillDefinition(actionType: string): CustomSkillDefinition | undefined {
  return CUSTOM_SKILL_DEFINITIONS.find(d => d.actionType === actionType);
}

