import type { AgentStep } from './AgentStep';
import type { StepResult } from './StepResult';

export class ExecutionTrace {
  private readonly steps: AgentStep[] = [];
  private readonly results: StepResult[] = [];

  public addStep(step: AgentStep): void {
    this.steps.push(step);
  }

  public addResult(result: StepResult): void {
    this.results.push(result);
  }

  public getSteps(): AgentStep[] {
    return [...this.steps];
  }

  public getResults(): StepResult[] {
    return [...this.results];
  }

  public isSuccessful(): boolean {
    if (this.results.length === 0) {
      return false;
    }
    return this.results.every((result) => result.success);
  }

  public getStepCount(): number {
    return this.steps.length;
  }
}
