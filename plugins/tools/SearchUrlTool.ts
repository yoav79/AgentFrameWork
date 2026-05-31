import { Tool } from '../../core/tools/Tool';
import { ToolResult } from '../../core/tools/ToolResult';
import { ToolPluginModule, PluginContext } from '../../core/plugins/contracts';

export class SearchUrlTool implements Tool {
  public readonly name = 'search_url';
  public readonly description = 'Fetches raw HTML or text from a specific URL and optionally searches for keywords inside it.';

  canHandle(actionType: string): boolean {
    return actionType === 'search_url';
  }

  async execute(input: unknown): Promise<ToolResult> {
    if (typeof input !== 'object' || input === null) {
      return { success: false, error: 'Input must be an object containing "url" and optional "query".' };
    }

    const payload = input as { url?: string; query?: string };
    const url = payload.url;
    const query = payload.query;

    if (!url || typeof url !== 'string' || url.trim() === '') {
      return { success: false, error: 'A valid "url" string is required.' };
    }

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; AgentFrameWorkBot/1.0)'
        },
        signal: AbortSignal.timeout(10000) // 10 seconds timeout
      });

      if (!response.ok) {
        return { success: false, error: `Failed to fetch URL. Status code: ${response.status}` };
      }

      const text = await response.text();
      
      // Strip HTML tags using simple regex
      const plainText = text
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      const maxLength = 2000;
      let resultText = plainText.length > maxLength ? plainText.substring(0, maxLength) + '...' : plainText;

      if (query && query.trim() !== '') {
        const lowerText = plainText.toLowerCase();
        const lowerQuery = query.toLowerCase();
        const matches: string[] = [];
        let index = lowerText.indexOf(lowerQuery);
        
        while (index !== -1 && matches.length < 5) {
          const start = Math.max(0, index - 40);
          const end = Math.min(plainText.length, index + lowerQuery.length + 40);
          matches.push(`...${plainText.substring(start, end).trim()}...`);
          index = lowerText.indexOf(lowerQuery, index + 1);
        }

        return {
          success: true,
          message: `Fetched URL and searched for query "${query}". Found ${matches.length} snippets.`,
          data: {
            url,
            query,
            matchCount: matches.length,
            snippets: matches,
            contentSnippet: resultText
          }
        };
      }

      return {
        success: true,
        message: `Successfully fetched URL content (${plainText.length} chars).`,
        data: {
          url,
          contentSnippet: resultText
        }
      };

    } catch (err: any) {
      return { success: false, error: `Network error fetching URL: ${err.message}` };
    }
  }
}

export const manifest: ToolPluginModule['manifest'] = {
  name: 'search_url',
  version: '1.0.0',
  kind: 'tool',
  actionType: 'search_url',
  description: 'Use ONLY when you need to retrieve text content or search for keywords from a specific URL.\n   - Payload expected: { "url": "https://example.com/page", "query": "optional keyword" }\n   - Do NOT use for files in the workspace (use read_file instead).',
  isTerminal: false,
  minConfidence: 0.8
};

export const create = (ctx: PluginContext): Tool => {
  return new SearchUrlTool();
};
