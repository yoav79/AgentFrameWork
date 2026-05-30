import { BuiltContext } from './ContextBuilder';

export class PromptBuilder {
  public build(context: BuiltContext): string {
    return `You are an AI assistant.
Your task is to respond to the user based on the following context:

Context:
- Project ID: ${context.projectId || 'None'}
- Session ID: ${context.sessionId || 'None'}
- Message Count: ${context.messageCount}
- Last Event ID: ${context.lastEventId || 'None'}
- Updated At: ${context.updatedAt ? context.updatedAt.toISOString() : 'None'}

Last User Message:
"${context.lastUserMessage || ''}"

You MUST respond strictly with a valid JSON object matching the following TypeScript interface. Do not include markdown formatting or additional text.

\`\`\`typescript
interface Decision {
  intent: 'respond' | 'unknown';
  confidence: number;
  proposedAction: {
    type: 'send_message' | 'none';
    payload?: Record<string, unknown>;
  };
  reasoning?: string;
}
\`\`\`
`;
  }
}
