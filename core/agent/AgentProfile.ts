export interface AgentProfile {
  id: string;
  name: string;
  description: string;
  persona: {
    systemInstructions: string;
    tone?: string;
    language?: string;
    responseStyle?: string;
  };
  goals?: string[];
  rules?: string[];
  enabledPlugins?: string[];
  allowedTools?: string[];
  allowedSkills?: string[];
  examples?: Array<{
    userMessage: string;
    expectedAction: string;
    expectedPayload?: Record<string, unknown>;
  }>;
  safety?: {
    blockedTopics?: string[];
    minConfidenceOverride?: Record<string, number>;
  };
  metadata?: Record<string, unknown>;
}
