import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CommandHandler } from '../../apps/cli/CommandHandler';
import { Kernel } from '../../core/kernel/Kernel';
import { MockLLMAdapter } from '../../core/llm/MockLLMAdapter';
import { ProjectDirectoryAdapter } from '../../apps/cli/ProjectDirectoryAdapter';
import { FrameworkError } from '../../core/errors/FrameworkError';

describe('CommandHandler Integration', () => {
  let mockDirectoryAdapter: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDirectoryAdapter = {
      listProjects: vi.fn().mockReturnValue(['test-project']),
      projectExists: vi.fn().mockReturnValue(false),
      createProject: vi.fn(),
    };
  });

  it('should call kernel.run and render response for normal message', async () => {
    const mockLlm = new MockLLMAdapter();
    mockLlm.setResponse({ content: 'Test response' });
    const kernel = new Kernel({ llm: mockLlm });
    
    // Spy on kernel.run
    const runSpy = vi.spyOn(kernel, 'run');

    const handler = new CommandHandler(['hello'], kernel, mockDirectoryAdapter as ProjectDirectoryAdapter);
    
    // Spy on console to check rendering
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await handler.execute();

    expect(runSpy).toHaveBeenCalled();
    const contextArg = runSpy.mock.calls[0]![0];
    expect(contextArg.input).toBe('hello');
    
    expect(consoleSpy).toHaveBeenCalledWith('Test response');
    
    runSpy.mockRestore();
    consoleSpy.mockRestore();
  });

  it('should pass projectId to context if --project is used', async () => {
    const mockLlm = new MockLLMAdapter();
    const kernel = new Kernel({ llm: mockLlm });
    const runSpy = vi.spyOn(kernel, 'run');
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const handler = new CommandHandler(['--project', 'p1', 'hello'], kernel, mockDirectoryAdapter as ProjectDirectoryAdapter);
    await handler.execute();

    expect(runSpy).toHaveBeenCalled();
    const contextArg = runSpy.mock.calls[0]![0];
    expect(contextArg.input).toBe('hello');
    expect(contextArg.projectId).toBe('p1');

    runSpy.mockRestore();
    consoleSpy.mockRestore();
  });

  it('should ignore LLM flags and pass correct input message', async () => {
    const mockLlm = new MockLLMAdapter();
    const kernel = new Kernel({ llm: mockLlm });
    const runSpy = vi.spyOn(kernel, 'run');
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const handler = new CommandHandler(['--llm', 'openai', '--model', 'gpt-4o', '--api-key', '123', 'hello', 'world'], kernel, mockDirectoryAdapter as ProjectDirectoryAdapter);
    await handler.execute();

    expect(runSpy).toHaveBeenCalled();
    const contextArg = runSpy.mock.calls[0]![0];
    expect(contextArg.input).toBe('hello world');

    runSpy.mockRestore();
    consoleSpy.mockRestore();
  });

  it('should pass sessionId to context if --session is used', async () => {
    const mockLlm = new MockLLMAdapter();
    const kernel = new Kernel({ llm: mockLlm });
    const runSpy = vi.spyOn(kernel, 'run');
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const handler = new CommandHandler(['--session', 's1', 'hello'], kernel, mockDirectoryAdapter as ProjectDirectoryAdapter);
    await handler.execute();

    expect(runSpy).toHaveBeenCalled();
    const contextArg = runSpy.mock.calls[0]![0];
    expect(contextArg.input).toBe('hello');
    expect(contextArg.sessionId).toBe('s1');

    runSpy.mockRestore();
    consoleSpy.mockRestore();
  });

  it('should catch context creation errors and render them safely', async () => {
    const mockLlm = new MockLLMAdapter();
    const errorKernel = new Kernel({ llm: mockLlm });
    vi.spyOn(errorKernel, 'run').mockRejectedValue(new FrameworkError('INTERNAL_ERROR', 'Kernel crashed'));
    
    const handler = new CommandHandler(['hello'], errorKernel, mockDirectoryAdapter as ProjectDirectoryAdapter);
    
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await handler.execute();
    
    expect(consoleErrorSpy).toHaveBeenCalled();
    expect(consoleErrorSpy.mock.calls[0]![0]).toContain('Kernel crashed');
    
    consoleErrorSpy.mockRestore();
  });

  it('should preserve /help command without calling kernel', async () => {
    const mockLlm = new MockLLMAdapter();
    const kernel = new Kernel({ llm: mockLlm });
    const runSpy = vi.spyOn(kernel, 'run');
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const handler = new CommandHandler(['--help'], kernel, mockDirectoryAdapter as ProjectDirectoryAdapter);
    await handler.execute();

    expect(runSpy).not.toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalled();
    
    runSpy.mockRestore();
    consoleSpy.mockRestore();
  });

  it('should not call kernel and render error for empty direct message', async () => {
    const mockLlm = new MockLLMAdapter();
    const kernel = new Kernel({ llm: mockLlm });
    const runSpy = vi.spyOn(kernel, 'run');
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const handler = new CommandHandler(['   '], kernel, mockDirectoryAdapter as ProjectDirectoryAdapter);
    await handler.execute();

    expect(runSpy).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalled();
    expect(consoleErrorSpy.mock.calls[0]![0]).toContain('Execution context input cannot be empty.');

    runSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });
});
