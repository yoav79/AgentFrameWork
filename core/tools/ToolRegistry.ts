import { Tool } from './Tool';
import { FrameworkError } from '../errors/FrameworkError';

export class ToolRegistry {
  private tools: Map<string, Tool> = new Map();

  public register(tool: Tool): void {
    if (this.tools.has(tool.name)) {
      throw new FrameworkError('REGISTRY_ERROR', `Tool with name '${tool.name}' is already registered.`);
    }
    this.tools.set(tool.name, tool);
  }

  public getToolForAction(actionType: string): Tool | undefined {
    for (const tool of this.tools.values()) {
      if (tool.canHandle(actionType)) {
        return tool;
      }
    }
    return undefined;
  }

  public getRegisteredTools(): Tool[] {
    return Array.from(this.tools.values());
  }
}
