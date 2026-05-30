import { BuiltContext } from './ContextBuilder';

export class PromptBuilder {
  public build(context: BuiltContext): string {
    let prompt = `You are an AI assistant.
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
If the user asks you to read a file, you MUST use the 'read_file' action and set intent to 'respond'. If the user asks a question or you want to reply, use 'send_message'.

\`\`\`typescript
interface Decision {
  intent: 'respond' | 'unknown';
  confidence: number;
  proposedAction: {
    type: 'send_message' | 'none' | 'read_file';
    payload?: Record<string, unknown>; // For read_file, include { "path": "filename.ext" }. For send_message, include { "message": "..." }
  };
  reasoning?: string;
}
\`\`\`
`;

    if (context.history) {
      const h = context.history;
      let memorySection = '\nRecent Memory:\n';
      
      for (const msg of h.recentUserMessages) {
        memorySection += `- [User] Message: "${msg}"\n`;
      }
      for (const act of h.recentActions) {
        if (act.success) {
          memorySection += `- [System] Action Executed (${act.actionType}): Success${act.message ? ' - ' + act.message : ''}\n`;
        } else {
          memorySection += `- [System] Action Failed (${act.actionType}): ${act.error || 'Unknown error'}\n`;
        }
      }
      for (const rej of h.recentPolicyRejections) {
        memorySection += `- [System] Policy Rejected: Action "${rej.actionType || 'unknown'}" blocked (${rej.reason})\n`;
      }

      // Insert memory section before the Last User Message
      const parts = prompt.split('Last User Message:');
      prompt = parts[0] + memorySection + '\nLast User Message:' + parts[1];
    }

    return prompt;
  }
}
