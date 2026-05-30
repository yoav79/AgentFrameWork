import { LLMAdapter } from '../../core/llm/LLMAdapter';
import { MockLLMAdapter } from '../../core/llm/MockLLMAdapter';
import { OpenAIAdapter } from '../../core/llm/OpenAIAdapter';
import { FrameworkError } from '../../core/errors/FrameworkError';
import { ConfigFactory } from '../../core/config/ConfigFactory';

export class AdapterFactory {
  public static createAdapter(args: string[]): LLMAdapter {
    let provider = 'mock';
    let apiKey: string | undefined = process.env.OPENAI_API_KEY;
    let model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      if (arg === '--llm') {
        provider = args[++i]!;
      } else if (arg === '--api-key') {
        apiKey = args[++i];
      } else if (arg === '--model') {
        model = args[++i]!;
      }
    }

    if (provider === 'mock') {
      const config = ConfigFactory.createDefault();
      const mockLlm = new MockLLMAdapter();
      mockLlm.setResponse({ content: (config as unknown as Record<string, unknown>).mockResponse as string || 'Mock LLM response' });
      return mockLlm;
    }

    if (provider === 'openai') {
      if (!apiKey) {
        throw new FrameworkError('CONFIG_ERROR', 'API Key is required for OpenAI provider. Please set OPENAI_API_KEY environment variable or use --api-key <key>.');
      }
      return new OpenAIAdapter({ apiKey, model });
    }

    throw new FrameworkError('CONFIG_ERROR', `Unknown LLM provider: ${provider}. Supported providers: mock, openai.`);
  }
}
