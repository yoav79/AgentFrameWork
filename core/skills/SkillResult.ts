export interface SkillResult {
  success: boolean;
  message?: string;
  data?: Record<string, unknown>;
  error?: string;
}
