import { Skill } from '../core/skills/Skill';
import { SkillResult } from '../core/skills/SkillResult';

interface ValidateRequiredFieldsPayload {
  fields: Record<string, unknown>;
  required: string[];
}

function isPresent(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string' && value.trim() === '') return false;
  return true;
}

function parsePayload(input: unknown): { payload: ValidateRequiredFieldsPayload } | { error: string } {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return { error: 'Payload must be a non-null object.' };
  }
  const raw = input as Record<string, unknown>;

  if (
    typeof raw['fields'] !== 'object' ||
    raw['fields'] === null ||
    Array.isArray(raw['fields'])
  ) {
    return { error: 'Payload.fields must be a non-null, non-array object.' };
  }

  if (!Array.isArray(raw['required']) || !(raw['required'] as unknown[]).every(r => typeof r === 'string')) {
    return { error: 'Payload.required must be an array of strings.' };
  }

  return {
    payload: {
      fields: raw['fields'] as Record<string, unknown>,
      required: raw['required'] as string[]
    }
  };
}

export class ValidateRequiredFieldsSkill implements Skill {
  public readonly name = 'validate_required_fields';
  public readonly description =
    'Validates that all required fields are present and non-empty in a given data object. ' +
    'Returns which fields are missing without throwing an error.';

  public canHandle(actionType: string): boolean {
    return actionType === 'validate_required_fields';
  }

  public execute(input: unknown): SkillResult {
    const parsed = parsePayload(input);

    if ('error' in parsed) {
      return { success: false, error: parsed.error };
    }

    const { fields, required } = parsed.payload;
    const missing = required.filter(key => !isPresent(fields[key]));

    return {
      success: true,
      message: 'Required fields validation completed.',
      data: {
        valid: missing.length === 0,
        missing
      }
    };
  }
}
