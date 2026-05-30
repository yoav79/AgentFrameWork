import { LLMAdapter, LLMGenerateInput, LLMGenerateResult } from './LLMAdapter';
import OpenAI from 'openai';
import { FrameworkError } from '../errors/FrameworkError';

export interface OpenAIResponsesClientLike {
  responses: {
    create: (params: any) => Promise<any>;
  };
}

export interface OpenAIAdapterOptions {
  apiKey?: string;
  model: string;
  client?: OpenAIResponsesClientLike;
}

export class OpenAIAdapter implements LLMAdapter {
  private client: OpenAIResponsesClientLike;
  private model: string;

  constructor(options: OpenAIAdapterOptions) {
    this.model = options.model;
    if (options.client) {
      this.client = options.client;
    } else {
      this.client = new OpenAI({ apiKey: options.apiKey });
    }
  }

  public async generate(input: LLMGenerateInput): Promise<LLMGenerateResult> {
    const formattedMessages = input.messages.map(msg => {
      if (msg.role === 'tool') {
        throw new FrameworkError('INTERNAL_ERROR', 'tool role is not supported yet.');
      }
      return {
        role: msg.role,
        content: msg.content
      };
    });

    const params: any = {
      model: this.model,
      input: formattedMessages
    };

    if (input.temperature !== undefined) {
      params.temperature = input.temperature;
    }
    
    if (input.maxTokens !== undefined) {
      params.max_tokens = input.maxTokens;
    }

    const response = await this.client.responses.create(params);

    let contentStr: string | undefined;

    if (response.output_text && typeof response.output_text === 'string' && response.output_text.trim() !== '') {
      contentStr = response.output_text;
    } else if (response.output && typeof response.output === 'string' && response.output.trim() !== '') {
      contentStr = response.output;
    }

    if (!contentStr) {
      throw new FrameworkError('INTERNAL_ERROR', 'OpenAI response did not include usable content.');
    }

    const result: LLMGenerateResult = {
      content: contentStr,
      raw: response
    };

    if (response.usage) {
      result.usage = {
        inputTokens: response.usage.prompt_tokens,
        outputTokens: response.usage.completion_tokens,
        totalTokens: response.usage.total_tokens
      };
    }

    return result;
  }
}
