import { Decision } from '../schemas/Decision';
import { PolicyDecision } from './PolicyDecision';

export class PolicyEngine {
  public evaluate(decision: Decision): PolicyDecision {
    if (decision.proposedAction && decision.proposedAction.type === 'none') {
      return {
        allowed: true,
        reason: 'Action "none" is always allowed as it is harmless.',
        severity: 'info'
      };
    }

    if (decision.confidence < 0.6) {
      return {
        allowed: false,
        reason: `Confidence score (${decision.confidence}) is below the required threshold of 0.6.`,
        severity: 'warning'
      };
    }

    if (decision.proposedAction) {
      if (decision.proposedAction.type === 'send_message') {
        return {
          allowed: true,
          reason: 'Action "send_message" is allowed with sufficient confidence.',
          severity: 'info'
        };
      }

      return {
        allowed: false,
        reason: `Action type "${decision.proposedAction.type}" is unknown or not permitted.`,
        severity: 'critical'
      };
    }

    // Default deny if there's no proposed action type matched
    return {
      allowed: false,
      reason: 'No proposed action specified.',
      severity: 'warning'
    };
  }
}
