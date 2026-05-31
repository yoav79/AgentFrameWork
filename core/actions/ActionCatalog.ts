export interface ActionDefinition {
  type: string;
  description: string;
  isTerminal: boolean;
  minConfidence: number;
}

export const ACTION_CATALOG: ActionDefinition[] = [
  {
    type: 'send_message',
    description: 'Use when you can respond to the user.\n   - Payload expected: { "message": "..." }',
    isTerminal: true,
    minConfidence: 0.6
  },
  {
    type: 'none',
    description: 'Use when there is no useful or safe action.\n   - Payload expected: {}',
    isTerminal: true,
    minConfidence: 0.0
  },
  {
    type: 'read_file',
    description: 'Use ONLY when you need to read a specific file from the workspace.\n   - Payload expected: { "path": "relative/path.ts" }\n   - MUST use relative paths. NO absolute paths.\n   - NO path traversal (..).\n   - DO NOT read secrets, .env, .git, or node_modules.\n   - DO NOT read directories.\n   - If the user provides just a filename (e.g. \'text.txt\'), assume it is in the root directory (i.e. use "text.txt").',
    isTerminal: false,
    minConfidence: 0.85
  }
];

export class ActionCatalog {
  public static getActions(): ActionDefinition[] {
    return ACTION_CATALOG;
  }

  public static getActionTypes(): string[] {
    return ACTION_CATALOG.map(a => a.type);
  }

  public static getAction(type: string): ActionDefinition | undefined {
    return ACTION_CATALOG.find(a => a.type === type);
  }

  public static isTerminal(type: string): boolean {
    const action = this.getAction(type);
    return action ? action.isTerminal : false;
  }

  public static isValidAction(type: string): boolean {
    return ACTION_CATALOG.some(a => a.type === type);
  }
}
