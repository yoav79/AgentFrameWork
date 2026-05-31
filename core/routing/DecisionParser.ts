import { Decision } from '../schemas/Decision';
import { FrameworkError } from '../errors/FrameworkError';
import { ActionCatalog } from '../actions/ActionCatalog';

export class DecisionParser {
  private readonly actionCatalog: ActionCatalog;

  constructor(actionCatalog?: ActionCatalog) {
    // If not provided, fall back to the default static catalog
    this.actionCatalog = actionCatalog || new ActionCatalog(ActionCatalog.getActions());
  }

  public parse(raw: string): Decision {
    try {
      let cleanedRaw = raw.trim();
      if (cleanedRaw.startsWith('```json')) {
        cleanedRaw = cleanedRaw.replace(/^```json\n/, '');
        if (cleanedRaw.endsWith('```')) {
          cleanedRaw = cleanedRaw.slice(0, -3).trim();
        }
      }

      const parsed = JSON.parse(cleanedRaw);

      if (parsed.intent && typeof parsed.intent === 'string') {
        const lowerIntent = parsed.intent.toLowerCase().trim();
        if (['none', 'greet', 'greeting', 'social', 'conversation', 'respond | unknown'].includes(lowerIntent)) {
          parsed.intent = 'respond';
        }
      }

      if (!parsed.intent || (parsed.intent !== 'respond' && parsed.intent !== 'unknown')) {
        throw new FrameworkError('VALIDATION_ERROR', 'Decision must have a valid intent ("respond" or "unknown")');
      }

      if (typeof parsed.confidence !== 'number' || parsed.confidence < 0 || parsed.confidence > 1) {
        throw new FrameworkError('VALIDATION_ERROR', 'Decision confidence must be a number between 0 and 1');
      }

      if (!parsed.proposedAction) {
        parsed.proposedAction = { type: 'none', payload: {} };
      } else if (!parsed.proposedAction.type) {
        parsed.proposedAction.type = 'none';
        if (!parsed.proposedAction.payload) {
          parsed.proposedAction.payload = {};
        }
      }

      if (!parsed.proposedAction || !parsed.proposedAction.type || !this.actionCatalog.isValidAction(parsed.proposedAction.type)) {
        const typesStr = this.actionCatalog.getActionTypes().map(t => `"${t}"`);
        let typesJoined = typesStr.join(', ');
        if (typesStr.length > 1) {
          const last = typesStr.pop();
          typesJoined = typesStr.join(', ') + ', or ' + last;
        }
        throw new FrameworkError('VALIDATION_ERROR', `Decision must have a valid proposedAction.type (${typesJoined})`);
      }

      if (parsed.proposedAction.type === 'read_file') {
        const payload = parsed.proposedAction.payload;
        if (!payload || typeof payload.path !== 'string' || payload.path.trim() === '') {
          throw new FrameworkError('VALIDATION_ERROR', 'Action "read_file" requires a valid "path" string in the payload');
        }
      }

      return parsed as Decision;
    } catch (error) {
      if (error instanceof FrameworkError) {
        throw error;
      }
      throw new FrameworkError('VALIDATION_ERROR', 'Failed to parse raw decision as JSON: ' + (error as Error).message);
    }
  }
}
