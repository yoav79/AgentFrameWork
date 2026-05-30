import { Decision } from '../schemas/Decision';
import { FrameworkError } from '../errors/FrameworkError';

export class DecisionParser {
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

      if (!parsed.intent || (parsed.intent !== 'respond' && parsed.intent !== 'unknown')) {
        throw new FrameworkError('VALIDATION_ERROR', 'Decision must have a valid intent ("respond" or "unknown")');
      }

      if (typeof parsed.confidence !== 'number' || parsed.confidence < 0 || parsed.confidence > 1) {
        throw new FrameworkError('VALIDATION_ERROR', 'Decision confidence must be a number between 0 and 1');
      }

      if (!parsed.proposedAction || !parsed.proposedAction.type || (parsed.proposedAction.type !== 'send_message' && parsed.proposedAction.type !== 'none' && parsed.proposedAction.type !== 'read_file')) {
        throw new FrameworkError('VALIDATION_ERROR', 'Decision must have a valid proposedAction.type ("send_message", "none", or "read_file")');
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
