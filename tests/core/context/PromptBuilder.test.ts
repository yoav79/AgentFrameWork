import { describe, it, expect } from 'vitest';
import { PromptBuilder } from '../../../core/context/PromptBuilder';
import { BuiltContext } from '../../../core/context/ContextBuilder';

describe('PromptBuilder', () => {
  it('should generate instructions demanding JSON based on context', () => {
    const builder = new PromptBuilder();
    const context: BuiltContext = {
      messageCount: 1,
      lastUserMessage: 'hello',
      projectId: 'p-1',
      sessionId: 's-1'
    };
    
    const prompt = builder.build(context);
    
    expect(prompt).not.toContain('hello');
    expect(prompt).toContain('p-1');
    expect(prompt).toContain('s-1');
    expect(prompt).toContain('valid JSON object');
    expect(prompt).not.toContain('Recent Memory:');
    
    // Assert tool catalog and rules
    expect(prompt).toContain('send_message');
    expect(prompt).toContain('none');
    expect(prompt).toContain('read_file');
    
    // Assert JSON Schema expected
    expect(prompt).toContain('"proposedAction"');
    expect(prompt).toContain('"confidence"');
    expect(prompt).toContain('"path":');
    
    // Assert read_file specific rules
    expect(prompt).toContain('relative paths');
    expect(prompt).toContain('NO path traversal (..)');
    expect(prompt).toContain('.env');
    expect(prompt).toContain('.git');
    expect(prompt).toContain('node_modules');
    
    // Assert negative rules (must not mention hallucinated tools)
    expect(prompt).not.toContain('write_file');
    expect(prompt).not.toContain('search_files');
    expect(prompt).not.toContain('list_files');
    expect(prompt).not.toContain('run_command');
  });

  it('should include Recent Memory section if history exists', () => {
    const builder = new PromptBuilder();
    const context: BuiltContext = {
      messageCount: 2,
      lastUserMessage: 'hello again',
      history: {
        recentUserMessages: ['hello'],
        recentActions: [
          { actionType: 'send_message', success: true, message: 'hi' },
          { actionType: 'do_magic', success: false, error: 'fail' }
        ],
        recentPolicyRejections: [
          { reason: 'blocked', actionType: 'format' }
        ],
        eventCount: 4
      }
    };
    
    const prompt = builder.build(context);
    
    expect(prompt).toContain('Recent Memory:');
    expect(prompt).toContain('- [User] Message: "hello"');
    expect(prompt).toContain('- [System] Action Executed (send_message): Success');
    expect(prompt).toContain('- [System] Action Failed (do_magic): fail');
    expect(prompt).toContain('- [System] Policy Rejected: Action "format" blocked (blocked)');
    expect(prompt).not.toContain('Last User Message:');
  });

  it('should render ephemeralStepContext if provided', () => {
    const builder = new PromptBuilder();
    const context: BuiltContext = {
      messageCount: 1,
      ephemeralStepContext: {
        actionType: 'read_file',
        message: 'File read successfully',
        data: { content: 'some raw content' }
      }
    };
    
    const prompt = builder.build(context);
    
    expect(prompt).toContain('Previous Tool Result:');
    expect(prompt).toContain('Action: read_file');
    expect(prompt).toContain('Message: File read successfully');
    expect(prompt).toContain('"content": "some raw content"');
    
    // Validar que las reglas anti-alucinación sigan presentes
    expect(prompt).toContain('send_message');
    expect(prompt).not.toContain('write_file');
  });

  it('should not render Previous Tool Result if ephemeralStepContext is absent', () => {
    const builder = new PromptBuilder();
    const context: BuiltContext = {
      messageCount: 1
    };
    
    const prompt = builder.build(context);
    expect(prompt).not.toContain('Previous Tool Result:');
  });

  it('should render Working Memory section when workingMemory contains entries', () => {
    const builder = new PromptBuilder();
    const context: BuiltContext = {
      messageCount: 1,
      workingMemory: [
        {
          id: 'wm-1',
          kind: 'file',
          source: 'a.txt',
          actionType: 'read_file',
          content: 'line1\nline2',
          loadedAt: new Date()
        },
        {
          id: 'wm-2',
          kind: 'tool_result',
          source: 'https://example.com',
          actionType: 'read_url',
          data: { success: true },
          loadedAt: new Date()
        }
      ]
    };

    const prompt = builder.build(context);
    expect(prompt).toContain('Working Memory (Artifacts retrieved during this session):');
    expect(prompt).toContain('- [file] "a.txt" (obtained via read_file):');
    expect(prompt).toContain('  line1');
    expect(prompt).toContain('  line2');
    expect(prompt).toContain('- [tool_result] "https://example.com" (obtained via read_url):');
    expect(prompt).toContain('Data: {"success":true}');
  });

  it('should always include Retrieval Rule (MANDATORY) instructions', () => {
    const builder = new PromptBuilder();
    const context: BuiltContext = { messageCount: 1 };
    const prompt = builder.build(context);
    expect(prompt).toContain('Retrieval Rule (MANDATORY)');
    expect(prompt).toContain('Do NOT use the "none" action');
  });
});
