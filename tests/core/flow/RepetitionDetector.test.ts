import { describe, it, expect } from 'vitest';
import { RepetitionDetector } from '../../../core/flow/RepetitionDetector';

describe('RepetitionDetector', () => {
  it('does not flag first occurrence as repeated', () => {
    const detector = new RepetitionDetector(2);
    const action = { actionType: 'read_file', payload: { path: 'test.txt' } };
    
    expect(detector.getRepeatCount(action)).toBe(0);
    expect(detector.isRepeated(action)).toBe(false);
    
    detector.record(action);
    expect(detector.getRepeatCount(action)).toBe(1);
    expect(detector.isRepeated(action)).toBe(false);
  });

  it('flags second occurrence as repeated when maxRepeatedActions = 2', () => {
    const detector = new RepetitionDetector(2);
    const action = { actionType: 'read_file', payload: { path: 'test.txt' } };
    
    detector.record(action);
    expect(detector.isRepeated(action)).toBe(false);
    
    detector.record(action);
    expect(detector.getRepeatCount(action)).toBe(2);
    expect(detector.isRepeated(action)).toBe(true);
  });

  it('keeps action types isolated', () => {
    const detector = new RepetitionDetector(2);
    const action1 = { actionType: 'read_file', payload: { path: 'test.txt' } };
    const action2 = { actionType: 'write_file', payload: { path: 'test.txt' } };
    
    detector.record(action1);
    detector.record(action2);
    
    expect(detector.getRepeatCount(action1)).toBe(1);
    expect(detector.getRepeatCount(action2)).toBe(1);
    expect(detector.isRepeated(action1)).toBe(false);
    expect(detector.isRepeated(action2)).toBe(false);
  });

  it('keeps payloads isolated', () => {
    const detector = new RepetitionDetector(2);
    const action1 = { actionType: 'read_file', payload: { path: 'a.txt' } };
    const action2 = { actionType: 'read_file', payload: { path: 'b.txt' } };
    
    detector.record(action1);
    detector.record(action2);
    
    expect(detector.getRepeatCount(action1)).toBe(1);
    expect(detector.getRepeatCount(action2)).toBe(1);
  });

  it('considers objects with keys in different order as equal', () => {
    const detector = new RepetitionDetector(2);
    const action1 = { actionType: 'custom_skill', payload: { a: 1, b: 2 } };
    const action2 = { actionType: 'custom_skill', payload: { b: 2, a: 1 } };
    
    detector.record(action1);
    expect(detector.getRepeatCount(action2)).toBe(1);
    
    detector.record(action2);
    expect(detector.getRepeatCount(action1)).toBe(2);
    expect(detector.isRepeated(action1)).toBe(true);
    expect(detector.isRepeated(action2)).toBe(true);
  });

  it('considers nested objects with keys in different order as equal', () => {
    const detector = new RepetitionDetector(2);
    const action1 = { actionType: 'custom_skill', payload: { nested: { x: 10, y: 20 }, b: 2 } };
    const action2 = { actionType: 'custom_skill', payload: { b: 2, nested: { y: 20, x: 10 } } };
    
    detector.record(action1);
    expect(detector.getRepeatCount(action2)).toBe(1);
  });

  it('considers arrays with different order as different', () => {
    const detector = new RepetitionDetector(2);
    const action1 = { actionType: 'custom_skill', payload: { list: [1, 2] } };
    const action2 = { actionType: 'custom_skill', payload: { list: [2, 1] } };
    
    detector.record(action1);
    expect(detector.getRepeatCount(action2)).toBe(0);
    
    detector.record(action2);
    expect(detector.getRepeatCount(action1)).toBe(1);
    expect(detector.getRepeatCount(action2)).toBe(1);
  });

  it('handles undefined and missing payloads consistently', () => {
    const detector = new RepetitionDetector(2);
    const action1 = { actionType: 'none', payload: undefined };
    const action2 = { actionType: 'none' };
    const action3 = { actionType: 'none', payload: { a: undefined } };
    
    detector.record(action1);
    expect(detector.getRepeatCount(action2)).toBe(1);
    expect(detector.getRepeatCount(action3)).toBe(1);
    
    detector.record(action2);
    expect(detector.isRepeated(action1)).toBe(true);
    expect(detector.isRepeated(action2)).toBe(true);
    expect(detector.isRepeated(action3)).toBe(true);
  });

  it('resets the state correctly', () => {
    const detector = new RepetitionDetector(2);
    const action = { actionType: 'none' };
    
    detector.record(action);
    detector.record(action);
    expect(detector.isRepeated(action)).toBe(true);
    
    detector.reset();
    expect(detector.getRepeatCount(action)).toBe(0);
    expect(detector.isRepeated(action)).toBe(false);
  });
});
