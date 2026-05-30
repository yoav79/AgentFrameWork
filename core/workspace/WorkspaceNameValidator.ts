import { FrameworkError } from '../errors/FrameworkError';

export class WorkspaceNameValidator {
  public static validate(name: string | undefined | null): string {
    if (!name || name.trim() === '') {
      throw new FrameworkError('VALIDATION_ERROR', 'Project name cannot be empty');
    }

    if (name === '.' || name === '..') {
      throw new FrameworkError('VALIDATION_ERROR', 'Project name cannot be "." or ".."');
    }

    if (/[^a-zA-Z0-9_-]/.test(name)) {
      throw new FrameworkError('VALIDATION_ERROR', 'Project name can only contain alphanumeric characters, hyphens, and underscores');
    }

    return name;
  }
}
