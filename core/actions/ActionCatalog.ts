export interface ActionDefinition {
  type: string;
  description: string;
  isTerminal: boolean;
  minConfidence: number;
}

export const BASE_ACTIONS: ActionDefinition[] = [
  {
    type: 'send_message',
    description: 'Use when you can respond to the user.\n   - Payload expected: { "message": "..." }',
    isTerminal: true,
    minConfidence: 0.6
  },
  {
    type: 'none',
    description: 'Use ONLY when there is genuinely no action to take:\n   - The user sent an empty or purely social message ("ok", "thanks").\n   - There is no question, task, or request to perform.\n   - Payload expected: {}\n\n   DO NOT use "none" when:\n   - The user asks a question about a file, URL, or data → use the appropriate tool or answer from Working Memory.\n   - The user asks any question you can answer → use send_message.\n   - The agent has just successfully executed a tool or completed a user request → use send_message to report the outcome to the user.',
    isTerminal: true,
    minConfidence: 0.0
  }
];

export class ActionCatalog {
  private actions: ActionDefinition[] = [];

  constructor(customActions: ActionDefinition[] = []) {
    this.actions = [...BASE_ACTIONS];
    for (const act of customActions) {
      this.register(act);
    }
  }

  public register(action: ActionDefinition): void {
    const existingIndex = this.actions.findIndex(a => a.type === action.type);
    if (existingIndex >= 0) {
      this.actions[existingIndex] = action;
    } else {
      this.actions.push(action);
    }
  }

  public getActions(): ActionDefinition[] {
    return this.actions;
  }

  public getActionTypes(): string[] {
    return this.actions.map(a => a.type);
  }

  public getAction(type: string): ActionDefinition | undefined {
    return this.actions.find(a => a.type === type);
  }

  public isTerminal(type: string): boolean {
    const action = this.getAction(type);
    return action ? action.isTerminal : false;
  }

  public isValidAction(type: string): boolean {
    return this.actions.some(a => a.type === type);
  }

  // --- Static Backwards Compatibility Fallbacks ---
  private static readonly defaultCatalog = new ActionCatalog([
    {
      type: 'read_file',
      description: 'Use ONLY when you need to read a specific file from the workspace.\n   - Payload expected: { "path": "relative/path.ts" }\n   - MUST use relative paths. NO absolute paths.\n   - NO path traversal (..).\n   - DO NOT read secrets, .env, .git, or node_modules.\n   - DO NOT read directories.\n   - If the user provides just a filename (e.g. \'text.txt\'), assume it is in the root directory (i.e. use "text.txt").',
      isTerminal: false,
      minConfidence: 0.85
    }
  ]);

  public static getActions(): ActionDefinition[] {
    return this.defaultCatalog.getActions();
  }

  public static getActionTypes(): string[] {
    return this.defaultCatalog.getActionTypes();
  }

  public static getAction(type: string): ActionDefinition | undefined {
    return this.defaultCatalog.getAction(type);
  }

  public static isTerminal(type: string): boolean {
    return this.defaultCatalog.isTerminal(type);
  }

  public static isValidAction(type: string): boolean {
    return this.defaultCatalog.isValidAction(type);
  }
}
