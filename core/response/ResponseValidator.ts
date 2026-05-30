import { FrameworkResponse, RESPONSE_TYPES } from './ResponseSchemaFactory';

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

export class ResponseValidator {
  public static isValidResponse(input: unknown): input is FrameworkResponse {
    return this.validate(input).isValid;
  }

  public static validate(input: unknown): ValidationResult {
    if (!input || typeof input !== 'object') {
      return { isValid: false, error: 'Input is not a valid object' };
    }

    const obj = input as Record<string, unknown>;

    if (typeof obj.type !== 'string' || !RESPONSE_TYPES.includes(obj.type as any)) {
      return { isValid: false, error: `Invalid or missing type. Must be one of: ${RESPONSE_TYPES.join(', ')}` };
    }

    if (typeof obj.content !== 'string') {
      return { isValid: false, error: 'Invalid or missing content. Must be a string.' };
    }

    if ('metadata' in obj && obj.metadata !== undefined) {
      if (typeof obj.metadata !== 'object' || obj.metadata === null || Array.isArray(obj.metadata)) {
        return { isValid: false, error: 'Metadata must be a non-null object and not an array.' };
      }
    }

    return { isValid: true };
  }
}
