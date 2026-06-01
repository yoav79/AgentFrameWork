import { ActionDefinition } from './ActionDefinition';
import { getNativeSkillDefinitions } from '../skills/NativeSkills';
export type { ActionDefinition };

export const BASE_ACTIONS: ActionDefinition[] = getNativeSkillDefinitions().map(def => def.actionDefinition);

export class ActionCatalog {
  private actions: ActionDefinition[] = [];

  constructor(customActions: ActionDefinition[] = [], allowedSkills?: string[]) {
    this.actions = allowedSkills
      ? BASE_ACTIONS.filter(a => allowedSkills.includes(a.type))
      : [...BASE_ACTIONS];
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
