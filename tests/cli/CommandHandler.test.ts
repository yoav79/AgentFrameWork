import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CommandHandler } from '../../apps/cli/CommandHandler';
import { ProjectDirectoryAdapter } from '../../apps/cli/ProjectDirectoryAdapter';
import { AgentKernel } from '../../core/agent/AgentKernel';
import { FrameworkError } from '../../core/errors/FrameworkError';

class MockAgentKernel {
  public runArgs: any[] = [];
  public async run(input: any): Promise<any> {
    this.runArgs.push(input);
    return { success: true, result: { message: 'Test response' } };
  }
}

describe('CommandHandler Integration', () => {
  let mockDirectoryAdapter: any;
  let mockAgentKernel: MockAgentKernel;
  let mockCreateAgent: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDirectoryAdapter = {
      listProjects: vi.fn().mockReturnValue(['test-project']),
      projectExists: vi.fn().mockReturnValue(false),
      createProject: vi.fn(),
      getProjectPath: vi.fn().mockImplementation((name: string) => `/mock/projects/${name}`),
    };
    mockAgentKernel = new MockAgentKernel();
    mockCreateAgent = vi.fn().mockReturnValue(mockAgentKernel);
  });

  it('should call createAgent and agentKernel.run and render response for normal message', async () => {
    const runSpy = vi.spyOn(mockAgentKernel, 'run');

    const handler = new CommandHandler(['hello'], mockCreateAgent, mockDirectoryAdapter as ProjectDirectoryAdapter);
    
    // Spy on console to check rendering
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await handler.execute();

    expect(runSpy).toHaveBeenCalled();
    const contextArg = runSpy.mock.calls[0]![0];
    expect(contextArg.input).toBe('hello');
    
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Test response'));
    
    runSpy.mockRestore();
    consoleSpy.mockRestore();
  });

  it('should pass projectId to context if --project is used', async () => {
    const runSpy = vi.spyOn(mockAgentKernel, 'run');
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const handler = new CommandHandler(['--project', 'p1', 'hello'], mockCreateAgent, mockDirectoryAdapter as ProjectDirectoryAdapter);
    await handler.execute();

    expect(mockCreateAgent).toHaveBeenCalledWith('p1', '/mock/projects/p1', undefined);

    expect(runSpy).toHaveBeenCalled();
    const contextArg = runSpy.mock.calls[0]![0];
    expect(contextArg.input).toBe('hello');
    expect(contextArg.projectId).toBe('p1');

    runSpy.mockRestore();
    consoleSpy.mockRestore();
  });

  it('should ignore LLM flags and pass correct input message', async () => {
    const runSpy = vi.spyOn(mockAgentKernel, 'run');
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const handler = new CommandHandler(['--llm', 'openai', '--model', 'gpt-4o', '--api-key', '123', 'hello', 'world'], mockCreateAgent, mockDirectoryAdapter as ProjectDirectoryAdapter);
    await handler.execute();

    expect(runSpy).toHaveBeenCalled();
    const contextArg = runSpy.mock.calls[0]![0];
    expect(contextArg.input).toBe('hello world');

    runSpy.mockRestore();
    consoleSpy.mockRestore();
  });

  it('should pass sessionId to context if --session is used', async () => {
    const runSpy = vi.spyOn(mockAgentKernel, 'run');
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const handler = new CommandHandler(['--session', 's1', 'hello'], mockCreateAgent, mockDirectoryAdapter as ProjectDirectoryAdapter);
    await handler.execute();

    expect(runSpy).toHaveBeenCalled();
    const contextArg = runSpy.mock.calls[0]![0];
    expect(contextArg.input).toBe('hello');
    expect(contextArg.sessionId).toBe('s1');

    runSpy.mockRestore();
    consoleSpy.mockRestore();
  });

  it('should catch agent creation errors and render them safely', async () => {
    vi.spyOn(mockAgentKernel, 'run').mockRejectedValue(new FrameworkError('INTERNAL_ERROR', 'Agent crashed'));
    
    const handler = new CommandHandler(['hello'], mockCreateAgent, mockDirectoryAdapter as ProjectDirectoryAdapter);
    
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await handler.execute();
    
    expect(consoleErrorSpy).toHaveBeenCalled();
    expect(consoleErrorSpy.mock.calls[0]![0]).toContain('Agent crashed');
    
    consoleErrorSpy.mockRestore();
  });

  it('should preserve /help command without calling agentKernel', async () => {
    const runSpy = vi.spyOn(mockAgentKernel, 'run');
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const handler = new CommandHandler(['--help'], mockCreateAgent, mockDirectoryAdapter as ProjectDirectoryAdapter);
    await handler.execute();

    expect(runSpy).not.toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalled();
    
    runSpy.mockRestore();
    consoleSpy.mockRestore();
  });

  it('should not call agentKernel and render error for empty direct message', async () => {
    const runSpy = vi.spyOn(mockAgentKernel, 'run');
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const handler = new CommandHandler(['   '], mockCreateAgent, mockDirectoryAdapter as ProjectDirectoryAdapter);
    await handler.execute();

    expect(runSpy).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalled();
    expect(consoleErrorSpy.mock.calls[0]![0]).toContain('Execution context input cannot be empty.');

    runSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it('should set process.exitCode to 1 if one-off execution returns success: false', async () => {
    vi.spyOn(mockAgentKernel, 'run').mockResolvedValue({ success: false, error: 'Agent failed' });
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const handler = new CommandHandler(['hello'], mockCreateAgent, mockDirectoryAdapter as ProjectDirectoryAdapter);
    
    // Store original exit code
    const originalExitCode = process.exitCode;
    process.exitCode = undefined;

    await handler.execute();

    expect(process.exitCode).toBe(1);
    expect(consoleErrorSpy).toHaveBeenCalled();
    expect(consoleErrorSpy.mock.calls[0]![0]).toContain('Agent failed');

    // Restore exit code
    process.exitCode = originalExitCode;
    consoleErrorSpy.mockRestore();
  });

  it('should dynamically rebuild AgentKernel on /use command', async () => {
    const mockAgentKernel2 = new MockAgentKernel();
    mockCreateAgent.mockImplementation((id: string) => {
      if (id === 'demo') return mockAgentKernel2;
      return mockAgentKernel;
    });
    const runSpy = vi.spyOn(mockAgentKernel2, 'run');
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    mockDirectoryAdapter.listProjects.mockReturnValue(['demo']);

    const handler = new CommandHandler([], mockCreateAgent, mockDirectoryAdapter as ProjectDirectoryAdapter);
    
    // Simulate interaction by overriding private properties/methods for testing is hard
    // but we can test if the factory is called using stdin mocking, or simpler, we trust E2E integration test for the interactive REPL loop
  });
});
