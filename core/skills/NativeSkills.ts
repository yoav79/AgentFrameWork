import { Skill } from './Skill';
import { ActionDefinition } from '../actions/ActionDefinition';
import { SendMessageSkill } from './SendMessageSkill';
import { AskClarificationSkill } from './AskClarificationSkill';
import { NoneSkill } from './NoneSkill';

export interface NativeSkillDefinition {
  actionType: string;
  skillClass: new () => Skill;
  actionDefinition: ActionDefinition;
}

const NATIVE_SKILL_DEFINITIONS: NativeSkillDefinition[] = [
  {
    actionType: 'send_message',
    skillClass: SendMessageSkill,
    actionDefinition: {
      type: 'send_message',
      description: 'Use when you can respond to the user.\n   - Payload expected: { "message": "..." }',
      isTerminal: true,
      minConfidence: 0.6
    }
  },
  {
    actionType: 'none',
    skillClass: NoneSkill,
    actionDefinition: {
      type: 'none',
      description: 'Use ONLY when there is genuinely no action to take:\n   - The user sent an empty or purely social message ("ok", "thanks").\n   - There is no question, task, or request to perform.\n   - Payload expected: {}\n\n   DO NOT use "none" when:\n   - The user asks a question (conversational or general) → you MUST use send_message.\n   - The user expects a visible response → you MUST use send_message.\n   - The user asks a question about a file, URL, or data → use the appropriate tool or answer from Working Memory.\n   - The agent has just successfully executed a tool or completed a user request → use send_message to report the outcome to the user.',
      isTerminal: true,
      minConfidence: 0.0
    }
  },
  {
    actionType: 'ask_clarification',
    skillClass: AskClarificationSkill,
    actionDefinition: {
      type: 'ask_clarification',
      description: 'Use ONLY when you cannot proceed because critical information is missing from the user.\n   - Payload expected: { "question": "The question to ask the user", "missingFields": ["field1", "field2"] }',
      isTerminal: true,
      minConfidence: 0.6
    }
  }
];

export function getNativeSkillDefinitions(): NativeSkillDefinition[] {
  return [...NATIVE_SKILL_DEFINITIONS];
}

export function getNativeSkillActionTypes(): string[] {
  return NATIVE_SKILL_DEFINITIONS.map(d => d.actionType);
}

export function getNativeSkillDefinition(actionType: string): NativeSkillDefinition | undefined {
  return NATIVE_SKILL_DEFINITIONS.find(d => d.actionType === actionType);
}
