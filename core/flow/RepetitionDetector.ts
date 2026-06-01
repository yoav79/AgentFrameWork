export interface RepetitionAction {
  actionType: string;
  payload?: unknown;
}

export class RepetitionDetector {
  private history: Map<string, number> = new Map();

  /**
   * @param maxRepeatedActions Represents the maximum allowed occurrences of a single action.
   *                           For example, if maxRepeatedActions = 2:
   *                           - First time: count = 1 (isRepeated = false)
   *                           - Second time: count = 2 (isRepeated = true)
   */
  constructor(private readonly maxRepeatedActions: number) {}

  public record(action: RepetitionAction): void {
    const key = this.getKey(action);
    const count = this.history.get(key) || 0;
    this.history.set(key, count + 1);
  }

  public isRepeated(action: RepetitionAction): boolean {
    return this.getRepeatCount(action) >= this.maxRepeatedActions;
  }

  public getRepeatCount(action: RepetitionAction): number {
    const key = this.getKey(action);
    return this.history.get(key) || 0;
  }

  public reset(): void {
    this.history.clear();
  }

  private getKey(action: RepetitionAction): string {
    const normalizedPayload = this.normalize(action.payload);
    return `${action.actionType}|${this.stableStringify(normalizedPayload)}`;
  }

  private normalize(value: unknown): unknown {
    if (value === null || value === undefined) {
      return undefined;
    }
    if (typeof value === 'object') {
      if (Array.isArray(value)) {
        return value.map(v => this.normalize(v));
      }
      const obj = value as Record<string, unknown>;
      const cleaned: Record<string, unknown> = {};
      let hasKeys = false;
      for (const k of Object.keys(obj)) {
        const val = obj[k];
        if (val !== undefined) {
          const normVal = this.normalize(val);
          if (normVal !== undefined) {
            cleaned[k] = normVal;
            hasKeys = true;
          }
        }
      }
      return hasKeys ? cleaned : undefined;
    }
    return value;
  }

  private stableStringify(value: unknown): string {
    if (value === null) {
      return 'null';
    }
    if (value === undefined) {
      return 'undefined';
    }
    if (typeof value !== 'object') {
      return typeof value + ':' + String(value);
    }
    if (Array.isArray(value)) {
      return '[' + value.map(v => this.stableStringify(v)).join(',') + ']';
    }
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort();
    const pairs = keys.map(k => `${k}:${this.stableStringify(obj[k])}`);
    return '{' + pairs.join(',') + '}';
  }
}
