import { describe, it, expect } from 'vitest';
import { ExecutionTrace } from '../../../core/flow/ExecutionTrace';
import { AgentStep } from '../../../core/flow/AgentStep';
import { StepResult } from '../../../core/flow/StepResult';

describe('ExecutionTrace', () => {
  it('should initialize empty', () => {
    const trace = new ExecutionTrace();
    expect(trace.getStepCount()).toBe(0);
    expect(trace.getSteps()).toEqual([]);
    expect(trace.getResults()).toEqual([]);
    expect(trace.isSuccessful()).toBe(false);
  });

  it('should add a successful StepResult and calculate success true', () => {
    const trace = new ExecutionTrace();
    const step: AgentStep = {
      id: 'step-1',
      actionType: 'test_action',
      startedAt: new Date()
    };
    const result: StepResult = {
      step,
      success: true
    };

    trace.addStep(step);
    trace.addResult(result);

    expect(trace.getStepCount()).toBe(1);
    expect(trace.isSuccessful()).toBe(true);
    expect(trace.getSteps()[0]).toBe(step);
    expect(trace.getResults()[0]).toBe(result);
  });

  it('should calculate global success false if any step fails', () => {
    const trace = new ExecutionTrace();
    const step1: AgentStep = { id: 's1', actionType: 'a1', startedAt: new Date() };
    const step2: AgentStep = { id: 's2', actionType: 'a2', startedAt: new Date() };
    
    trace.addStep(step1);
    trace.addResult({ step: step1, success: true });
    
    trace.addStep(step2);
    trace.addResult({ step: step2, success: false, error: 'failed' });

    expect(trace.getStepCount()).toBe(2);
    expect(trace.isSuccessful()).toBe(false);
  });

  it('should return defensive copies', () => {
    const trace = new ExecutionTrace();
    const step: AgentStep = { id: 's1', actionType: 'a1', startedAt: new Date() };
    
    trace.addStep(step);
    
    const steps = trace.getSteps();
    steps.push({ id: 's2', actionType: 'a2', startedAt: new Date() });
    
    expect(trace.getStepCount()).toBe(1);
    expect(trace.getSteps().length).toBe(1);
  });
});
