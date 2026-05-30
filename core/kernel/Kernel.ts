import { KernelOptions } from './KernelOptions';
import { LLMAdapter } from '../llm/LLMAdapter';
import { ExecutionContext } from '../context/ExecutionContext';
import { FrameworkResponse } from '../response/ResponseSchemaFactory';
import { ResponseNormalizer } from '../response/ResponseNormalizer';

export class Kernel {
  private readonly llm: LLMAdapter;

  constructor(options: KernelOptions) {
    this.llm = options.llm;
  }

  public async run(context: ExecutionContext): Promise<FrameworkResponse> {
    try {
      const messages = [
        { role: 'user' as const, content: context.input }
      ];

      const result = await this.llm.generate({ messages });
      
      return ResponseNormalizer.normalize(result.content);
    } catch (error) {
      return ResponseNormalizer.normalize(error);
    }
  }
}
