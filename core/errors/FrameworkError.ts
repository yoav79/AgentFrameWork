import { ErrorCode } from './ErrorCodes';

export class FrameworkError extends Error {
  public readonly code: ErrorCode;
  public readonly metadata?: Record<string, unknown>;

  constructor(code: ErrorCode, message: string, metadata?: Record<string, unknown>) {
    super(message);
    this.name = 'FrameworkError';
    this.code = code;
    this.metadata = metadata;
    
    // Set the prototype explicitly to ensure instanceof works correctly in TS/ES5
    Object.setPrototypeOf(this, FrameworkError.prototype);
    
    // Capture stack trace safely
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, FrameworkError);
    }
  }
}
