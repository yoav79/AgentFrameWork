import { describe, it, expect, vi } from 'vitest';
import { SearchUrlTool } from '../../../plugins/tools/SearchUrlTool';

interface SearchUrlResultData {
  contentSnippet?: string;
  matchCount?: number;
  snippets?: string[];
}

describe('SearchUrlTool', () => {
  it('should only handle search_url action', () => {
    const tool = new SearchUrlTool();
    expect(tool.canHandle('search_url')).toBe(true);
    expect(tool.canHandle('read_file')).toBe(false);
  });

  it('should fetch url and return stripped text content', async () => {
    const tool = new SearchUrlTool();
    const mockResponse = {
      ok: true,
      status: 200,
      text: async () => '<html><head><style>body {color: red;}</style></head><body><h1>Hello World</h1><script>console.log("hi");</script></body></html>'
    };
    
    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockResolvedValue(mockResponse);

    try {
      const result = await tool.execute({ url: 'https://example.com' });
      expect(result.success).toBe(true);
      const data = result.data as SearchUrlResultData | undefined;
      expect(data?.contentSnippet).toBe('Hello World');
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('should filter snippets matching query', async () => {
    const tool = new SearchUrlTool();
    const mockResponse = {
      ok: true,
      status: 200,
      text: async () => 'This is a long website text that contains a special keyword here and other things.'
    };
    
    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockResolvedValue(mockResponse);

    try {
      const result = await tool.execute({ url: 'https://example.com', query: 'keyword' });
      expect(result.success).toBe(true);
      const data = result.data as SearchUrlResultData | undefined;
      expect(data?.matchCount).toBe(1);
      expect(data?.snippets?.[0]).toContain('special keyword here');
    } finally {
      global.fetch = originalFetch;
    }
  });
});
