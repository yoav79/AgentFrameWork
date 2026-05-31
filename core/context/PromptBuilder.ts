import { BuiltContext } from './ContextBuilder';
import { ActionCatalog } from '../actions/ActionCatalog';
import { AgentProfile } from '../agent/AgentProfile';

export class PromptBuilder {
  private readonly actionCatalog: ActionCatalog;
  private readonly agentProfile?: AgentProfile;

  constructor(actionCatalog?: ActionCatalog, agentProfile?: AgentProfile) {
    this.actionCatalog = actionCatalog || new ActionCatalog(ActionCatalog.getActions());
    this.agentProfile = agentProfile;
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

    const hasWrite = this.actionCatalog.isValidAction('write_file');
    const hasRead = this.actionCatalog.isValidAction('read_file');

    let planningSection = '';
    if (hasWrite && hasRead) {
      planningSection = `
## Planning Rule (MANDATORY)
For complex, multi-step tasks (e.g. tasks requiring sequential read, search, analysis, and edit operations), if both the "read_file" and "write_file" actions are available in the "Available Actions" section below, you MUST manage your progress using a file named "plan.md" located at the root of the workspace (i.e. path "./plan.md"):
1. **Decision Output**: Your final response to the user's input must always remain a single, valid JSON object following the "JSON Schema Expected" format below. Writing or reading "plan.md" is performed through proposing the standard "read_file" or "write_file" actions.
2. **Pre-Read Plan**: Before writing or updating the "./plan.md" file, you MUST attempt to read it using the "read_file" action to ensure you do not overwrite existing progress, notes, or details.
3. **Creation**: If "./plan.md" does not exist yet, propose a "write_file" action to create the initial plan.
4. **Incremental Updates**: If "./plan.md" already exists, preserve all previous progress and useful notes, and update it incrementally.
5. **Simple Tasks Exception**: DO NOT create or use "plan.md" for greetings, simple conversational messages, tasks resolvable with a single action, or direct answers that do not require file inspection/modification.
6. **Plan Structure**: The "./plan.md" file MUST follow this structure:
   # Plan de Trabajo
   - [ ] Tarea 1 (Estado: ...)
   - [ ] Tarea 2 (Estado: ...)
   ## Objetivo
   <brief goal>
   ## Paso Actual
   <current task>
   ## Notas y Bloqueos
   <notes or errors encountered>
   ## Siguiente Acción
   <next tool to call>
7. **Execution Guidelines**: Advance only one useful action per loop iteration. Update "./plan.md" immediately after any relevant tool action has been completed. Do NOT mark steps as completed without concrete evidence.
8. **Exit Rule**: Once all tasks in "./plan.md" are marked as completed (e.g. all task checkboxes are "- [x]"), you MUST finalize the run by proposing a "send_message" action explaining the outcome. Do NOT propose further tool calls after the plan is completed.
9. **Anti-Loop**: If the same action fails twice or you make no observable progress, update "./plan.md" with details of the blockage if possible, and propose a "send_message" action explaining the problem to the user to gracefully abort the execution loop.
10. **Unavailable Write File**: If "write_file" is not available in the "Available Actions" list, do NOT attempt to use or write a physical "plan.md" file.
`;
    }

    let profileSection = '';
    if (this.agentProfile) {
      profileSection += `## Agent Identity\nName: ${this.agentProfile.name}\nDescription: ${this.agentProfile.description}\n\n`;
      profileSection += `## Persona Instructions\n${this.agentProfile.persona.systemInstructions}\n`;
      if (this.agentProfile.persona.tone) {
        profileSection += `Tone: ${this.agentProfile.persona.tone}\n`;
      }
      if (this.agentProfile.persona.language) {
        profileSection += `Language: ${this.agentProfile.persona.language}\n`;
      }
      if (this.agentProfile.persona.responseStyle) {
        profileSection += `Response Style: ${this.agentProfile.persona.responseStyle}\n`;
      }
      profileSection += `\n`;

      if (this.agentProfile.goals && this.agentProfile.goals.length > 0) {
        profileSection += `## Agent Goals\n${this.agentProfile.goals.map(g => `- ${g}`).join('\n')}\n\n`;
      }

      if (this.agentProfile.rules && this.agentProfile.rules.length > 0) {
        profileSection += `## Domain Rules\n${this.agentProfile.rules.map(r => `- ${r}`).join('\n')}\n\n`;
      }

      if (this.agentProfile.examples && this.agentProfile.examples.length > 0) {
        profileSection += `## Examples\n`;
        for (const ex of this.agentProfile.examples) {
          profileSection += `User: ${ex.userMessage}\n`;
          profileSection += `Expected Action: ${ex.expectedAction}\n`;
          if (ex.expectedPayload) {
            profileSection += `Expected Payload: ${JSON.stringify(ex.expectedPayload)}\n`;
          }
          profileSection += `\n`;
        }
      }
      profileSection += `CRITICAL NOTE: Framework rules below override persona instructions if there is any conflict.\n\n`;
    }

    let prompt = '';
    if (this.agentProfile) {
      prompt = `${profileSection}Your task is to respond to the user based on the following context:`;
    } else {
      prompt = `You are an AI assistant.\nYour task is to respond to the user based on the following context:`;
    }

    prompt += `

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
Do NOT invent action types. If the user's request has been completed, requires a response, is a conversational message, greeting with a query, or if the user expects a visible answer, you MUST use 'send_message' to reply to the user. Do NOT use 'none' when the user is asking a question or expecting a response. Use 'none' ONLY when the user message is purely social (e.g., 'ok', 'thanks') and no task, question, or response is needed.

## Execution & Termination Rule (MANDATORY)
1. You are executing in a multi-step loop. If you have already successfully executed the tool(s) required to satisfy the user's request (such as writing a file with a write tool, or searching with a search tool), DO NOT execute the same tool again with the same or similar payload.
2. Once the task is done, you MUST use the "send_message" action to explain the result and complete the interaction.

## Retrieval Rule (MANDATORY)
If the user asks for information that can be retrieved using an available tool (such as "read_file" to view a workspace file's content) and that information is NOT currently visible in the "Working Memory" section above:
1. Do NOT use the "none" action.
2. Do NOT hallucinate or guess the answer.
3. You MUST execute the appropriate tool (e.g. "read_file") to retrieve the necessary data.
${planningSection}
Available Actions:
${availableActionsList}

${ephemeralSection}JSON Schema Expected:
{
  "intent": "respond",
  "confidence": 0.9,
  "proposedAction": {
    "type": "send_message",
    "payload": {
      "message": "Puedo ayudarte a inspeccionar archivos, usar herramientas y resolver tareas paso a paso."
    }
  },
  "reasoning": "The user asked a direct conversational question that requires a visible answer."
}

Field Instructions:
1. "intent": You MUST choose and output exactly either "respond" or "unknown". Use "respond" when proposing any action (including "none" and all tools). Use "unknown" ONLY if you cannot understand the user at all.
2. "confidence": You MUST use a score of 0.8 or higher (e.g. 0.9, 1.0) when proposing a valid tool or action. DO NOT use 0.0 for proposed tools.
3. "proposedAction.type": You MUST set this to one of the available action types: ${expectedActionTypes}.
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
