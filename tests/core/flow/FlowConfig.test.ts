import { describe, it, expect } from 'vitest';
import { DEFAULT_FLOW_CONFIG } from '../../../core/flow/FlowConfig';

describe('FlowConfig', () => {
  it('should have DEFAULT_FLOW_CONFIG that preserves single-pass behavior', () => {
    expect(DEFAULT_FLOW_CONFIG.maxSteps).toBe(1);
    expect(DEFAULT_FLOW_CONFIG.allowRetries).toBe(false);
    expect(DEFAULT_FLOW_CONFIG.maxRetries).toBe(0);
    expect(DEFAULT_FLOW_CONFIG.maxToolCalls).toBe(1);
    expect(DEFAULT_FLOW_CONFIG.stopOnPolicyRejection).toBe(true);
    expect(DEFAULT_FLOW_CONFIG.stopOnToolError).toBe(true);
  });
});
