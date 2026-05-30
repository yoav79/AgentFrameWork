import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';
import { join } from 'path';

describe('CLI Smoke / Integration Tests', () => {
  const cliPath = join(__dirname, '../../apps/cli/cli.ts');

  it('should run a one-off command with default mock and not fail with JSON error', () => {
    const output = execSync(`npx tsx ${cliPath} "hola"`).toString();
    // Debe imprimir la respuesta del mock
    expect(output).toContain('Mock LLM response');
    // No debe contener el error de JSON
    expect(output).not.toContain('Failed to parse raw decision as JSON');
  });

  it('should not require --agent and should ignore it if present', () => {
    const output = execSync(`npx tsx ${cliPath} --agent "hola"`).toString();
    expect(output).toContain('Mock LLM response');
  });

  it('should not treat --persist as a positional message', () => {
    const output = execSync(`npx tsx ${cliPath} --persist "hola"`).toString();
    expect(output).toContain('Mock LLM response');
  });

  it('should exit with code 1 if success is false', () => {
    // We can simulate an error by using a mock provider that throws or fails if we configure it,
    // but the requirement "si es viable testearlo sin proceso real" was fulfilled in CommandHandler.test.ts.
    // We can also test here if we provide an invalid LLM provider
    try {
      execSync(`npx tsx ${cliPath} --llm invalid_provider "hola"`);
      // Should not reach here
      expect(true).toBe(false);
    } catch (error: any) {
      expect(error.status).toBe(1);
      expect(error.stderr?.toString() || error.stdout?.toString()).toContain('Unknown LLM provider: invalid_provider');
    }
  });
});
