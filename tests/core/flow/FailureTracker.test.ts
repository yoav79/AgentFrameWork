import { describe, it, expect } from 'vitest';
import { FailureTracker } from '../../../core/flow/FailureTracker';

describe('FailureTracker', () => {
  it('starts with 0 consecutive failures and hasReachedLimit false', () => {
    const tracker = new FailureTracker(2);
    expect(tracker.getConsecutiveFailures()).toBe(0);
    expect(tracker.hasReachedLimit()).toBe(false);
  });

  it('increments consecutive failures when recordFailure is called', () => {
    const tracker = new FailureTracker(2);
    tracker.recordFailure();
    expect(tracker.getConsecutiveFailures()).toBe(1);
    expect(tracker.hasReachedLimit()).toBe(false);
  });

  it('reaches the limit at the second failure when maxConsecutiveFailures = 2', () => {
    const tracker = new FailureTracker(2);
    
    tracker.recordFailure();
    expect(tracker.hasReachedLimit()).toBe(false);
    
    tracker.recordFailure();
    expect(tracker.getConsecutiveFailures()).toBe(2);
    expect(tracker.hasReachedLimit()).toBe(true);
  });

  it('resets consecutive failures to 0 on recordSuccess', () => {
    const tracker = new FailureTracker(2);
    tracker.recordFailure();
    expect(tracker.getConsecutiveFailures()).toBe(1);
    
    tracker.recordSuccess();
    expect(tracker.getConsecutiveFailures()).toBe(0);
    expect(tracker.hasReachedLimit()).toBe(false);
  });

  it('resets consecutive failures to 0 on reset', () => {
    const tracker = new FailureTracker(2);
    tracker.recordFailure();
    tracker.recordFailure();
    expect(tracker.hasReachedLimit()).toBe(true);
    
    tracker.reset();
    expect(tracker.getConsecutiveFailures()).toBe(0);
    expect(tracker.hasReachedLimit()).toBe(false);
  });

  it('does not reach limit if there is an intermediate success', () => {
    const tracker = new FailureTracker(2);
    
    tracker.recordFailure();
    expect(tracker.getConsecutiveFailures()).toBe(1);
    
    tracker.recordSuccess();
    expect(tracker.getConsecutiveFailures()).toBe(0);
    
    tracker.recordFailure();
    expect(tracker.getConsecutiveFailures()).toBe(1);
    expect(tracker.hasReachedLimit()).toBe(false);
  });

  it('throws a clear error when constructor parameter is 0', () => {
    expect(() => new FailureTracker(0)).toThrow('maxConsecutiveFailures must be greater than 0');
  });

  it('throws a clear error when constructor parameter is negative', () => {
    expect(() => new FailureTracker(-5)).toThrow('maxConsecutiveFailures must be greater than 0');
  });
});
