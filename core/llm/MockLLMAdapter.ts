import { LLMAdapter, LLMGenerateInput, LLMGenerateResult } from './LLMAdapter';

export class MockLLMAdapter implements LLMAdapter {
  private fixedResponse: LLMGenerateResult | null = null;
  private responseQueue: LLMGenerateResult[] = [];
  private currentError: Error | null = null;
  private calls: LLMGenerateInput[] = [];

  public async generate(input: LLMGenerateInput): Promise<LLMGenerateResult> {
    this.calls.push(input);

    if (this.currentError) {
      throw this.currentError;
    }

    if (this.responseQueue.length > 0) {
      return this.responseQueue.shift() as LLMGenerateResult;
    }

    if (this.fixedResponse) {
      return this.fixedResponse;
    }

    return {
      content: 'Default mock response'
    };
  }

  public getCalls(): LLMGenerateInput[] {
    return [...this.calls];
  }

  public getLastCall(): LLMGenerateInput | null {
    if (this.calls.length === 0) {
      return null;
    }
    return this.calls[this.calls.length - 1] || null;
  }

  public clearCalls(): void {
    this.calls = [];
  }

  public setResponse(response: LLMGenerateResult): void {
    this.fixedResponse = response;
  }

  public setResponses(responses: LLMGenerateResult[]): void {
    this.responseQueue = [...responses];
  }

  public setError(error: Error): void {
    this.currentError = error;
  }

  public clearError(): void {
    this.currentError = null;
  }
}
