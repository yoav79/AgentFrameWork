export interface ActionDefinition {
  type: string;
  description: string;
  isTerminal: boolean;
  minConfidence: number;
}
