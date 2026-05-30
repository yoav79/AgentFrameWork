export interface Decision {
  intent: 'respond' | 'unknown';
  confidence: number;
  proposedAction: {
    type: 'send_message' | 'none' | 'read_file';
    payload?: Record<string, unknown>;
  };
  reasoning?: string;
}
