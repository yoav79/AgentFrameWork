export type LLMProvider = 'mock' | 'openai';

export interface MockConfig {
  readonly llmProvider: 'mock';
  readonly mockResponse?: string;
}

export interface OpenAIConfig {
  readonly llmProvider: 'openai';
  readonly apiKey?: string;
  readonly model: string;
}

export type FrameworkConfig = MockConfig | OpenAIConfig;
