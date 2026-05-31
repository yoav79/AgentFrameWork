import { BuiltContext } from './ContextBuilder';

export class PromptBuilder {
  public build(context: BuiltContext): string {
    let ephemeralSection = '';
    if (context.ephemeralStepContext) {
      ephemeralSection = `
Previous Tool Result:
Action: ${context.ephemeralStepContext.actionType}`;
      if (context.ephemeralStepContext.message) {
        ephemeralSection += `\nMessage: ${context.ephemeralStepContext.message}`;
      }
      if (context.ephemeralStepContext.data !== undefined) {
        ephemeralSection += `\nData:\n${JSON.stringify(context.ephemeralStepContext.data, null, 2)}`;
      }
      ephemeralSection += '\n\nCRITICAL RULE: You have just received a tool result. You MUST now use the "send_message" action to communicate this result to the user. DO NOT use "none".\n\n';
    }

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


You MUST respond strictly with a valid JSON object. Do not include markdown formatting or additional text.
You HAVE the capability to execute the actions listed below. Do NOT claim that you lack the ability to read files or perform actions.
Do NOT invent action types. If no action applies, use 'none' or 'send_message'.

Available Actions:
1. send_message
   - Use when you can respond to the user.
   - Payload expected: { "message": "..." }
2. none
   - Use when there is no useful or safe action.
   - Payload expected: {}
3. read_file
   - Use ONLY when you need to read a specific file from the workspace.
   - Payload expected: { "path": "relative/path.ts" }
   - MUST use relative paths. NO absolute paths.
   - NO path traversal (..).
   - DO NOT read secrets, .env, .git, or node_modules.
   - DO NOT read directories.
   - If the user provides just a filename (e.g. 'text.txt'), assume it is in the root directory (i.e. use "text.txt").

${ephemeralSection}JSON Schema Expected:
{
  "intent": "respond | unknown",
  "confidence": 0.9,
  "proposedAction": {
    "type": "send_message | none | read_file",
    "payload": {}
  },
  "reasoning": "brief explanation"
}
NOTE: confidence must reflect how certain you are (0.0 = completely uncertain, 1.0 = fully certain). Use at least 0.8 when you have a clear action to perform.
`;

    if (context.history) {
      const h = context.history;
      let memorySection = '\nRecent Memory:\n';
      
      for (const msg of h.recentUserMessages) {
        memorySection += `- [User] Message: "${msg}"\n`;
      }
      for (const act of h.recentActions) {
        if (act.success) {
          // Intentionally omit message body — re-injecting previous responses
          // causes the LLM to think the task is already done.
          memorySection += `- [System] Action Executed (${act.actionType}): Success\n`;
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
