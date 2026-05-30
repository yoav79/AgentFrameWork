export interface HistoryContext {
  recentUserMessages: string[];
  recentActions: Array<{
    actionType: string;
    success: boolean;
    message?: string;
    error?: string;
  }>;
  recentPolicyRejections: Array<{
    reason: string;
    actionType?: string;
    confidence?: number;
  }>;
  eventCount: number;
}
