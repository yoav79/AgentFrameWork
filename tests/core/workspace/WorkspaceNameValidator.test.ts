import { describe, it, expect } from 'vitest';
import { WorkspaceNameValidator } from '../../../core/workspace/WorkspaceNameValidator';
import { FrameworkError } from '../../../core/errors/FrameworkError';

describe('WorkspaceNameValidator', () => {
  it('should accept valid names', () => {
    expect(WorkspaceNameValidator.validate('demo')).toBe('demo');
    expect(WorkspaceNameValidator.validate('project-123')).toBe('project-123');
    expect(WorkspaceNameValidator.validate('otro_workspace')).toBe('otro_workspace');
  });

  it('should reject empty or whitespace strings', () => {
    expect(() => WorkspaceNameValidator.validate('')).toThrow(FrameworkError);
    expect(() => WorkspaceNameValidator.validate('   ')).toThrow(FrameworkError);
    expect(() => WorkspaceNameValidator.validate(null as any)).toThrow(FrameworkError);
    expect(() => WorkspaceNameValidator.validate(undefined as any)).toThrow(FrameworkError);
  });

  it('should reject specific relative paths like . and ..', () => {
    expect(() => WorkspaceNameValidator.validate('.')).toThrow(FrameworkError);
    expect(() => WorkspaceNameValidator.validate('..')).toThrow(FrameworkError);
  });

  it('should reject names with invalid characters (path traversal or shell injection)', () => {
    expect(() => WorkspaceNameValidator.validate('../evil')).toThrow(FrameworkError);
    expect(() => WorkspaceNameValidator.validate('/tmp/evil')).toThrow(FrameworkError);
    expect(() => WorkspaceNameValidator.validate('evil\\\\path')).toThrow(FrameworkError);
    expect(() => WorkspaceNameValidator.validate('my workspace')).toThrow(FrameworkError);
    expect(() => WorkspaceNameValidator.validate('workspace!@#')).toThrow(FrameworkError);
  });
});
