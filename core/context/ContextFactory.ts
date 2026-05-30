import { ExecutionContext, ExecutionContextOptions } from './ExecutionContext';
import { FrameworkError } from '../errors/FrameworkError';

export class ContextFactory {
  public static create(options: unknown): ExecutionContext {
    if (!options || typeof options !== 'object' || Array.isArray(options)) {
      throw new FrameworkError('INTERNAL_ERROR', 'Context options must be a non-null object');
    }

    const opts = options as ExecutionContextOptions;

    if (typeof opts.input !== 'string') {
      throw new FrameworkError('INTERNAL_ERROR', 'Context input must be a string');
    }

    if (opts.input.trim() === '') {
      throw new FrameworkError('INTERNAL_ERROR', 'Execution context input cannot be empty.');
    }

    if (opts.projectId !== undefined && typeof opts.projectId !== 'string') {
      throw new FrameworkError('INTERNAL_ERROR', 'Context projectId must be a string if provided');
    }

    if (opts.sessionId !== undefined && typeof opts.sessionId !== 'string') {
      throw new FrameworkError('INTERNAL_ERROR', 'Context sessionId must be a string if provided');
    }

    if (opts.metadata !== undefined) {
      if (!opts.metadata || typeof opts.metadata !== 'object' || Array.isArray(opts.metadata)) {
        throw new FrameworkError('INTERNAL_ERROR', 'Context metadata must be a non-null object if provided');
      }
    }

    return {
      input: opts.input,
      projectId: opts.projectId,
      sessionId: opts.sessionId,
      metadata: opts.metadata
    };
  }
}
