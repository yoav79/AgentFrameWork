import { BuiltContext } from './ContextBuilder';
import { ActionCatalog } from '../actions/ActionCatalog';

export class PromptBuilder {
  private readonly actionCatalog: ActionCatalog;

  constructor(actionCatalog?: ActionCatalog) {
    this.actionCatalog = actionCatalog || new ActionCatalog(ActionCatalog.getActions());
  }

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
      ephemeralSection += '\n\nCRITICAL RULE: The previous action was a tool execution. If the tool succeeded and the user\'s request (e.g. creating/writing a file, searching, or reading) has been performed, you MUST use the "send_message" action to report the success and finalize the response. DO NOT repeat the tool execution if it has already succeeded. DO NOT use "none".\n\n';
    }

    const availableActionsList = this.actionCatalog.getActions()
      .map((action, i) => `${i + 1}. ${action.type}\n   - ${action.description.split('\n').join('\n   ')}`)
      .join('\n');

    const expectedActionTypes = this.actionCatalog.getActionTypes().join(' | ');

    let prompt = `You are an AI assistant.
Your task is to respond to the user based on the following context:

Context:
- Project ID: ${context.projectId || 'None'}
- Session ID: ${context.sessionId || 'None'}
- Message Count: ${context.messageCount}
- Last Event ID: ${context.lastEventId || 'None'}
- Updated At: ${context.updatedAt ? context.updatedAt.toISOString() : 'None'}
`;

    if (context.workingMemory && context.workingMemory.length > 0) {
      let wmSection = '\nWorking Memory (Artifacts retrieved during this session):\n';
      for (const entry of context.workingMemory) {
        wmSection += `- [${entry.kind}] "${entry.source}" (obtained via ${entry.actionType}):\n`;
        if (entry.content) {
          const indented = entry.content.split('\n').map(line => `  ${line}`).join('\n');
          wmSection += `${indented}\n`;
        } else if (entry.data) {
          wmSection += `  Data: ${JSON.stringify(entry.data)}\n`;
        }
      }
      prompt += wmSection;
    }

    prompt += `
You MUST respond strictly with a valid JSON object. Do not include markdown formatting or additional text.
You HAVE the capability to execute the actions listed below. Do NOT claim that you lack the ability to read files or perform actions.
Do NOT invent action types. If the user's request has been completed or requires a response, you MUST use 'send_message' to reply to the user. Use 'none' ONLY when the user message is purely social (e.g., 'greet', 'ok', 'thanks') and no task or response is needed.

## Execution & Termination Rule (MANDATORY)
1. You are executing in a multi-step loop. If you have already successfully executed the tool(s) required to satisfy the user's request (such as writing a file with a write tool, or searching with a search tool), DO NOT execute the same tool again with the same or similar payload.
2. Once the task is done, you MUST use the "send_message" action to explain the result and complete the interaction.

## Retrieval Rule (MANDATORY)
If the user asks for information that can be retrieved using an available tool (such as "read_file" to view a workspace file's content) and that information is NOT currently visible in the "Working Memory" section above:
1. Do NOT use the "none" action.
2. Do NOT hallucinate or guess the answer.
3. You MUST execute the appropriate tool (e.g. "read_file") to retrieve the necessary data.

Available Actions:
${availableActionsList}

${ephemeralSection}JSON Schema Expected:
{
  "intent": "respond | unknown",
  "confidence": 0.9,
  "proposedAction": {
    "type": "${expectedActionTypes}",
    "payload": {}
  },
  "reasoning": "brief explanation"
}

Field Instructions:
1. "intent": You MUST choose and output exactly either "respond" or "unknown". Use "respond" when proposing any action (including tools) to address or progress the user's request. Use "unknown" ONLY if you cannot understand the user at all.
2. "confidence": You MUST use a score of 0.8 or higher (e.g. 0.9, 1.0) when proposing a valid tool or action. DO NOT use 0.0 for proposed tools.
NOTE: confidence must reflect how certain you are (0.0 = completely uncertain, 1.0 = fully certain). You MUST use at least 0.8 when proposing a tool or action to address or progress the user's request.
`;

    if (context.history) {
      const h = context.history;
      let memorySection = '\nRecent Memory:\n';
      
      for (const msg of h.recentUserMessages) {
        memorySection += `- [User] Message: "${msg}"\n`;
      }
      for (const act of h.recentActions) {
        if (act.success) {
          const detail = (act.actionType === 'send_message' && act.message) ? ` (Response: "${act.message}")` : '';
          memorySection += `- [System] Action Executed (${act.actionType}): Success${detail}\n`;
        } else {
          memorySection += `- [System] Action Failed (${act.actionType}): ${act.error || 'Unknown error'}\n`;
        }
      }
      for (const rej of h.recentPolicyRejections) {
        memorySection += `- [System] Policy Rejected: Action "${rej.actionType || 'unknown'}" blocked (${rej.reason})\n`;
      }

      prompt += '\n' + memorySection;
    }

    return prompt;
  }
}
