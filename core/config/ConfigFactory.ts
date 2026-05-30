import { FrameworkConfig } from './FrameworkConfig';

export class ConfigFactory {
  public static createDefault(): FrameworkConfig {
    return {
      llmProvider: 'mock',
      mockResponse: JSON.stringify({
        intent: 'respond',
        confidence: 1,
        proposedAction: {
          type: 'send_message',
          payload: {
            message: 'Mock LLM response'
          }
        },
        reasoning: 'Mock decision'
      })
    };
  }
}
