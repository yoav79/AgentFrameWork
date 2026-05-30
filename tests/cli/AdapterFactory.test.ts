import { describe, it, expect, vi, afterEach } from 'vitest';
import { AdapterFactory } from '../../apps/cli/AdapterFactory';
import { MockLLMAdapter } from '../../core/llm/MockLLMAdapter';
import { OpenAIAdapter } from '../../core/llm/OpenAIAdapter';
import { FrameworkError } from '../../core/errors/FrameworkError';

vi.mock('../../core/llm/OpenAIAdapter');

describe('AdapterFactory', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it('should return MockLLMAdapter by default when no flags are provided', () => {
    const adapter = AdapterFactory.createAdapter([]);
    expect(adapter).toBeInstanceOf(MockLLMAdapter);
  });

  it('should return MockLLMAdapter when --llm mock is provided', () => {
    const adapter = AdapterFactory.createAdapter(['--llm', 'mock']);
    expect(adapter).toBeInstanceOf(MockLLMAdapter);
  });

  it('should return MockLLMAdapter without API key even if process.env.OPENAI_API_KEY is defined', () => {
    vi.stubEnv('OPENAI_API_KEY', 'env-key');
    const adapter = AdapterFactory.createAdapter(['--llm', 'mock']);
    expect(adapter).toBeInstanceOf(MockLLMAdapter);
  });

  it('should throw FrameworkError when --llm openai is provided without --api-key and without env var', () => {
    expect(() => {
      AdapterFactory.createAdapter(['--llm', 'openai']);
    }).toThrowError(FrameworkError);
    
    expect(() => {
      AdapterFactory.createAdapter(['--llm', 'openai']);
    }).toThrowError('API Key is required for OpenAI provider. Please set OPENAI_API_KEY environment variable or use --api-key <key>.');
  });

  it('should return OpenAIAdapter when --llm openai and --api-key are provided', () => {
    const adapter = AdapterFactory.createAdapter(['--llm', 'openai', '--api-key', 'test-key']);
    expect(adapter).toBeInstanceOf(OpenAIAdapter);
  });

  it('should return OpenAIAdapter when --llm openai is provided and process.env.OPENAI_API_KEY is defined', () => {
    vi.stubEnv('OPENAI_API_KEY', 'env-key');
    const adapter = AdapterFactory.createAdapter(['--llm', 'openai']);
    expect(adapter).toBeInstanceOf(OpenAIAdapter);
    expect(OpenAIAdapter).toHaveBeenCalledWith(expect.objectContaining({
      apiKey: 'env-key'
    }));
  });

  it('should prioritize --api-key flag over process.env.OPENAI_API_KEY', () => {
    vi.stubEnv('OPENAI_API_KEY', 'env-key');
    const adapter = AdapterFactory.createAdapter(['--llm', 'openai', '--api-key', 'flag-key']);
    expect(adapter).toBeInstanceOf(OpenAIAdapter);
    expect(OpenAIAdapter).toHaveBeenCalledWith(expect.objectContaining({
      apiKey: 'flag-key'
    }));
  });

  it('should initialize OpenAIAdapter with gpt-4o-mini as default model when no --model flag is provided', () => {
    AdapterFactory.createAdapter(['--llm', 'openai', '--api-key', 'test-key']);
    expect(OpenAIAdapter).toHaveBeenCalledWith(expect.objectContaining({
      apiKey: 'test-key',
      model: 'gpt-4o-mini'
    }));
  });

  it('should initialize OpenAIAdapter with a custom model when --model flag is provided', () => {
    AdapterFactory.createAdapter(['--llm', 'openai', '--api-key', 'test-key', '--model', 'gpt-4']);
    expect(OpenAIAdapter).toHaveBeenCalledWith(expect.objectContaining({
      apiKey: 'test-key',
      model: 'gpt-4'
    }));
  });

  it('should throw FrameworkError when an unknown provider is provided', () => {
    expect(() => {
      AdapterFactory.createAdapter(['--llm', 'inventado']);
    }).toThrowError(FrameworkError);

    expect(() => {
      AdapterFactory.createAdapter(['--llm', 'inventado']);
    }).toThrowError('Unknown LLM provider: inventado. Supported providers: mock, openai.');
  });
});
