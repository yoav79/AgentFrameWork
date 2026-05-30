export interface PolicyDecision {
  allowed: boolean;
  reason?: string;
  severity?: 'info' | 'warning' | 'critical';
}
