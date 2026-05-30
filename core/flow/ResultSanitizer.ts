export const MAX_VERBOSE_FIELD_LENGTH = 1000;

const DENY_LIST = new Set([
  'content',
  'raw',
  'buffer',
  'blob',
  'base64',
  'base64Data'
]);

const VERBOSE_LIST = new Set([
  'stdout',
  'stderr',
  'logs',
  'entries'
]);

export class ResultSanitizer {
  /**
   * Sanitizes execution data for tracing purposes.
   * Performs a shallow clone, removing heavy fields and truncating verbose ones.
   */
  public static sanitizeData(data: unknown): unknown {
    if (data === undefined || data === null) {
      return data;
    }

    if (typeof data !== 'object') {
      return data;
    }

    if (Array.isArray(data)) {
      // MVP: Retornar copia superficial del array sin recursión profunda.
      // Se asume que los payloads excesivos usualmente viven en llaves de objetos, no en root arrays de las tools actuales.
      return [...data];
    }

    const original = data as Record<string, unknown>;
    const sanitized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(original)) {
      // 1. Campos que deben eliminarse completamente
      if (DENY_LIST.has(key)) {
        continue;
      }

      // 2. Campos verbosos que deben truncarse
      if (VERBOSE_LIST.has(key)) {
        if (typeof value === 'string' && value.length > MAX_VERBOSE_FIELD_LENGTH) {
          sanitized[key] = value.substring(0, MAX_VERBOSE_FIELD_LENGTH);
          sanitized[`${key}Truncated`] = true;
          continue;
        }
        
        if (Array.isArray(value) && value.length > 50) {
          sanitized[key] = value.slice(0, 50);
          sanitized[`${key}Truncated`] = true;
          continue;
        }
      }

      // 3. Conservar el resto (metadata segura y valores normales)
      sanitized[key] = value;
    }

    return sanitized;
  }
}
