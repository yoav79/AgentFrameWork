import { FrameworkResponse } from './ResponseSchemaFactory';
import { ResponseValidator } from './ResponseValidator';

export class ResponseNormalizer {
  public static normalize(input: unknown): FrameworkResponse {
    if (typeof input === 'string') {
      return {
        type: 'message',
        content: input
      };
    }

    if (input instanceof Error) {
      return {
        type: 'error',
        content: input.message
      };
    }

    const validation = ResponseValidator.validate(input);
    if (validation.isValid) {
      return input as FrameworkResponse;
    }

    return {
      type: 'error',
      content: `Failed to normalize response: ${validation.error || 'Unknown error'}`
    };
  }
}
