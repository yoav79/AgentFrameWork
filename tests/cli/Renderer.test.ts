import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Renderer } from '../../apps/cli/Renderer';

describe('Renderer', () => {
  let renderer: Renderer;
  let logSpy: any;
  let errorSpy: any;

  beforeEach(() => {
    renderer = new Renderer();
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should render help message', () => {
    renderer.renderHelp();
    expect(logSpy).toHaveBeenCalled();
    expect(logSpy.mock.calls[0][0]).toContain('Usage: agentframework');
    expect(logSpy.mock.calls[0][0]).toContain('/session');
    expect(logSpy.mock.calls[0][0]).toContain('--llm');
    expect(logSpy.mock.calls[0][0]).toContain('mock, openai');
    expect(logSpy.mock.calls[0][0]).toContain('--api-key');
  });

  it('should render version', () => {
    renderer.renderVersion('1.0.0');
    expect(logSpy).toHaveBeenCalledWith('agentframework version 1.0.0');
  });

  it('should render a string response', () => {
    renderer.renderResponse('Hello world');
    expect(logSpy).toHaveBeenCalledWith('Hello world');
  });

  it('should render FrameworkResponse message as content', () => {
    renderer.renderResponse({ type: 'message', content: 'hola' });
    expect(logSpy).toHaveBeenCalledWith('hola');
  });

  it('should render FrameworkResponse error with controlled error output', () => {
    renderer.renderResponse({ type: 'error', content: 'Fallo' });
    expect(errorSpy).toHaveBeenCalled();
    expect(errorSpy.mock.calls[0][0]).toContain('Fallo');
  });

  it('should render FrameworkResponse approval_required with label', () => {
    renderer.renderResponse({ type: 'approval_required', content: '¿Aceptas?' });
    expect(logSpy).toHaveBeenCalled();
    expect(logSpy.mock.calls[0][0]).toContain('Approval required:');
    expect(logSpy.mock.calls[0][0]).toContain('¿Aceptas?');
  });

  it('should maintain JSON fallback for unknown objects', () => {
    renderer.renderResponse({ type: 'unknown_type', algo: 1 });
    expect(logSpy).toHaveBeenCalled();
    const output = logSpy.mock.calls[0][0];
    expect(output).toContain('"algo": 1');
  });

  it('should maintain JSON fallback for arrays', () => {
    renderer.renderResponse([1, 2, 3]);
    expect(logSpy).toHaveBeenCalled();
    const output = logSpy.mock.calls[0][0];
    expect(output).toContain('1');
    expect(output).toContain('3');
  });

  it('should render a readable error directly via renderError', () => {
    const error = new Error('Test error');
    renderer.renderError(error, false);
    expect(errorSpy).toHaveBeenCalled();
    expect(errorSpy.mock.calls[0][0]).toContain('Test error');
  });

  it('should render an error with stack trace in debug mode', () => {
    const error = new Error('Debug error');
    error.stack = 'Error: Debug error\n  at Object.<anonymous>';
    renderer.renderError(error, true);
    expect(errorSpy).toHaveBeenCalledTimes(2); // One for error message, one for trace
    expect(errorSpy.mock.calls[1][0]).toContain('[DEBUG TRACE]');
    expect(errorSpy.mock.calls[1][0]).toContain('at Object.<anonymous>');
  });

  it('should render a debug message', () => {
    renderer.renderDebug('A debug step', { meta: 123 });
    expect(logSpy).toHaveBeenCalledTimes(2);
    expect(logSpy.mock.calls[0][0]).toContain('[DEBUG] A debug step');
    expect(logSpy.mock.calls[1][0]).toContain('"meta": 123');
  });
});
