import { Decision } from '../schemas/Decision';
import { PolicyDecision } from './PolicyDecision';
import { ActionCatalog } from '../actions/ActionCatalog';

export class PolicyEngine {
  public evaluate(decision: Decision): PolicyDecision {
    if (!decision.proposedAction) {
      return {
        allowed: false,
        reason: 'No proposed action specified.',
        severity: 'warning'
      };
    }

    const type = decision.proposedAction.type;
    const actionDef = ActionCatalog.getAction(type);

    if (!actionDef) {
      return {
        allowed: false,
        reason: `Action type "${type}" is unknown or not permitted.`,
        severity: 'critical'
      };
    }

    if (type === 'none') {
      return {
        allowed: true,
        reason: 'Action "none" is always allowed as it is harmless.',
        severity: 'info'
      };
    }

    if (decision.confidence < actionDef.minConfidence) {
      if (type === 'send_message') {
        return {
          allowed: false,
          reason: `Confidence score (${decision.confidence}) is below the required threshold of 0.6.`,
          severity: 'warning'
        };
      }
      return {
        allowed: false,
        reason: `Action "${type}" requires a confidence score of at least ${actionDef.minConfidence} (current: ${decision.confidence}).`,
        severity: 'warning'
      };
    }

    if (type === 'send_message') {
      return {
        allowed: true,
        reason: 'Action "send_message" is allowed with sufficient confidence.',
        severity: 'info'
      };
    }

    if (type === 'read_file') {
      return {
        allowed: true,
        reason: 'Action "read_file" is allowed with high confidence.',
        severity: 'info'
      };
    }

    return {
      allowed: false,
      reason: `Action type "${type}" is unknown or not permitted.`,
      severity: 'critical'
    };
  }
}
