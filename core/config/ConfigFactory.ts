import { FrameworkConfig } from './FrameworkConfig';

export class ConfigFactory {
  public static createDefault(): FrameworkConfig {
    return {
      llmProvider: 'mock',
      mockResponse: 'Mock LLM response'
    };
  }
}
