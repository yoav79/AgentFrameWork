export type WorkingMemoryKind =
  | 'file'
  | 'tool_result'
  | 'search_result'
  | 'command_output';

export interface WorkingMemoryEntry {
  id: string;
  kind: WorkingMemoryKind;
  source: string;        // path, url, command, query, etc.
  actionType: string;    // read_file, search_files, run_command, ...
  content?: string;      // plain text if applicable
  data?: unknown;        // structured data if applicable
  metadata?: Record<string, unknown>;
  loadedAt: Date;
}
