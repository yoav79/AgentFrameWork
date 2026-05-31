import { describe, it, expect, vi } from 'vitest';
import { execSync } from 'child_process';
import { join } from 'path';
import { existsSync, rmSync, writeFileSync, mkdirSync } from 'fs';
import { homedir } from 'os';
import { CommandHandler } from '../../apps/cli/CommandHandler';
import { ProjectDirectoryAdapter } from '../../apps/cli/ProjectDirectoryAdapter';
import { AgentFactory } from '../../core/agent/AgentFactory';
import { MockLLMAdapter } from '../../core/llm/MockLLMAdapter';

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

  it('should fail immediately when --project is invalid (path traversal)', () => {
    try {
      execSync(`npx tsx ${cliPath} --project ../evil "hola"`);
      expect(true).toBe(false); // should not reach here
    } catch (error: any) {
      expect(error.status).toBe(1);
      expect(error.stderr?.toString() || error.stdout?.toString()).toContain('Project name can only contain');
    }
  });

  it('should reject /use ../evil in REPL', () => {
    // We can test this by passing input to the interactive mode via stdin
    const output = execSync(`echo "/use ../evil" | npx tsx ${cliPath}`).toString();
    expect(output).toContain('Project name can only contain');
    expect(output).not.toContain('Entrando al workspace');
  });

  it('should accept /use demo in REPL', () => {
    const uniqueProject = `demo_${Date.now()}`;
    const output = execSync(`echo "/create ${uniqueProject}\\n/use ${uniqueProject}" | npx tsx ${cliPath}`).toString();
    expect(output).toContain(`Workspace '${uniqueProject}' creado y seleccionado.`);
  });

  it('should rebuild AgentKernel with correct EventLog path after /use with --persist', () => {
    const uniqueProject = `test_proj_${Date.now()}`;
    // Feed two commands: /create project, then a normal message 'hola'
    const output = execSync(`echo "/create ${uniqueProject}\nhola\n/exit" | npx tsx ${cliPath} --persist`).toString();
    
    expect(output).toContain(`Workspace '${uniqueProject}' creado y seleccionado.`);
    expect(output).toContain('Mock LLM response');

    const expectedLogPath = join(homedir(), '.agentframework', 'projects', uniqueProject, 'events.json');
    expect(existsSync(expectedLogPath)).toBe(true);

    // Clean up
    rmSync(join(homedir(), '.agentframework', 'projects', uniqueProject), { recursive: true, force: true });
  });

  it('should execute read_file end-to-end programmatically', async () => {
    const uniqueProject = `integration_read_${Date.now()}`;
    const adapter = new ProjectDirectoryAdapter();
    adapter.createProject(uniqueProject);
    const projectPath = adapter.getProjectPath(uniqueProject);
    
    writeFileSync(join(projectPath, 'secret.txt'), 'super secret content', 'utf-8');

    const validJson = JSON.stringify({
      intent: 'respond',
      confidence: 1,
      proposedAction: { type: 'read_file', payload: { path: 'secret.txt' } }
    });
    
    let callCount = 0;
    const llmAdapter = {
      generate: async () => {
        callCount++;
        if (callCount === 1) {
          return { content: validJson };
        }
        return {
          content: JSON.stringify({
            intent: 'respond',
            confidence: 1,
            proposedAction: { type: 'send_message', payload: { message: 'File read successfully' } }
          })
        };
      }
    };
    
    const createAgent = (id?: string, root?: string) => AgentFactory.create(llmAdapter as any, {
      projectId: id,
      workspaceRoot: root
    });

    const handler = new CommandHandler(['--project', uniqueProject, 'hello'], createAgent, adapter);
    
    // Capture console output to verify success rendering
    const logs: string[] = [];
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation((msg: any) => {
      logs.push(msg);
    });

    await handler.execute();

    const output = logs.join('\\n');
    expect(output).toContain('File read successfully');
    
    consoleSpy.mockRestore();
    rmSync(projectPath, { recursive: true, force: true });
  });
});
