export class FailureTracker {
  private consecutiveFailures = 0;

  constructor(private readonly maxConsecutiveFailures: number) {
    if (maxConsecutiveFailures <= 0) {
      throw new Error('maxConsecutiveFailures must be greater than 0');
    }
  }

  public recordSuccess(): void {
    this.consecutiveFailures = 0;
  }

  public recordFailure(): void {
    this.consecutiveFailures++;
  }

  public getConsecutiveFailures(): number {
    return this.consecutiveFailures;
  }

  public hasReachedLimit(): boolean {
    return this.consecutiveFailures >= this.maxConsecutiveFailures;
  }

  public reset(): void {
    this.consecutiveFailures = 0;
  }
}
