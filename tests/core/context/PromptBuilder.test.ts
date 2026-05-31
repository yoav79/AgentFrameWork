import { describe, it, expect } from 'vitest';
import { PromptBuilder } from '../../../core/context/PromptBuilder';
import { BuiltContext } from '../../../core/context/ContextBuilder';
import { ActionCatalog } from '../../../core/actions/ActionCatalog';


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

  it('should include Planning Rule (MANDATORY) and all its requirements', () => {
    const catalog = new ActionCatalog([
      { type: 'read_file', description: 'read', isTerminal: false, minConfidence: 0.8 },
      { type: 'write_file', description: 'write', isTerminal: false, minConfidence: 0.8 }
    ]);
    const builder = new PromptBuilder(catalog);
    const context: BuiltContext = { messageCount: 1 };
    const prompt = builder.build(context);

    // 1. Contiene la sección principal
    expect(prompt).toContain('Planning Rule (MANDATORY)');

    // 2. Conserva sección JSON Schema Expected e instrucción estricta de JSON
    expect(prompt).toContain('JSON Schema Expected');
    expect(prompt).toContain('valid JSON object');

    // 3. Menciona plan.md y la regla de pre-lectura (read antes de write/update)
    expect(prompt).toContain('plan.md');
    expect(prompt).toContain('Pre-Read Plan');
    expect(prompt).toContain('attempt to read it using the "read_file" action');

    // 4. Indica no usar plan.md para tareas simples (greetings, conversational)
    expect(prompt).toContain('DO NOT create or use "plan.md" for greetings');

    // 5. Contiene regla anti-loop
    expect(prompt).toContain('fails twice or you make no observable progress');

    // 6. No elimina Available Actions
    expect(prompt).toContain('Available Actions:');
  });

  it('should format JSON Schema Expected example using send_message and contain instructions on send_message vs none', () => {
    const builder = new PromptBuilder();
    const context: BuiltContext = { messageCount: 1 };
    const prompt = builder.build(context);

    // Assert JSON Schema Expected example has "send_message" and its payload
    expect(prompt).toContain('"type": "send_message"');
    expect(prompt).toContain('"message": "Puedo ayudarte a inspeccionar archivos');

    // Assert instructions exist
    expect(prompt).toContain('Do NOT use \'none\' when the user is asking a question or expecting a response.');
    expect(prompt).toContain('is a conversational message, greeting with a query, or if the user expects a visible answer, you MUST use \'send_message\'');
  });

  it('should build prompt using AgentProfile when provided', () => {
    const profile = {
      id: 'test-agent',
      name: 'Testy',
      description: 'A test agent',
      persona: {
        systemInstructions: 'Act like a test runner.',
        tone: 'formal',
        language: 'en',
        responseStyle: 'short sentences'
      },
      goals: ['Test code', 'Report bugs'],
      rules: ['Do not crash', 'Report success'],
      examples: [
        {
          userMessage: 'run test',
          expectedAction: 'send_message',
          expectedPayload: { message: 'passed' }
        }
      ]
    };

    const catalog = new ActionCatalog([
      { type: 'read_file', description: 'read', isTerminal: false, minConfidence: 0.8 },
      { type: 'write_file', description: 'write', isTerminal: false, minConfidence: 0.8 }
    ]);
    const builder = new PromptBuilder(catalog, profile);
    const context: BuiltContext = { messageCount: 1 };
    const prompt = builder.build(context);

    // 1. Identity
    expect(prompt).toContain('## Agent Identity');
    expect(prompt).toContain('Name: Testy');
    expect(prompt).toContain('Description: A test agent');

    // 2. Persona instructions
    expect(prompt).toContain('## Persona Instructions');
    expect(prompt).toContain('Act like a test runner.');
    expect(prompt).toContain('Tone: formal');
    expect(prompt).toContain('Language: en');
    expect(prompt).toContain('Response Style: short sentences');

    // 3. Goals and rules
    expect(prompt).toContain('## Agent Goals');
    expect(prompt).toContain('- Test code');
    expect(prompt).toContain('- Report bugs');
    expect(prompt).toContain('## Domain Rules');
    expect(prompt).toContain('- Do not crash');
    expect(prompt).toContain('- Report success');

    // 4. Examples
    expect(prompt).toContain('## Examples');
    expect(prompt).toContain('User: run test');
    expect(prompt).toContain('Expected Action: send_message');
    expect(prompt).toContain('Expected Payload: {"message":"passed"}');

    // 5. Framework prioritization note
    expect(prompt).toContain('Framework rules below override persona instructions if there is any conflict.');

    // 6. Existing rules preserved
    expect(prompt).toContain('JSON Schema Expected');
    expect(prompt).toContain('Planning Rule (MANDATORY)');
    expect(prompt).toContain('Available Actions:');
    expect(prompt).toContain('Do NOT use \'none\' when the user is asking a question or expecting a response.');
  });

  it('should not include empty sections in PromptBuilder if AgentProfile does not have them', () => {
    const minimalProfile = {
      id: 'minimal',
      name: 'Mini',
      description: 'minimal desc',
      persona: {
        systemInstructions: 'Be minimal.'
      }
    };
    const builder = new PromptBuilder(undefined, minimalProfile);
    const context: BuiltContext = { messageCount: 1 };
    const prompt = builder.build(context);

    expect(prompt).toContain('## Agent Identity');
    expect(prompt).toContain('## Persona Instructions');
    expect(prompt).toContain('Be minimal.');
    
    // Not in profile, should not be rendered
    expect(prompt).not.toContain('Tone:');
    expect(prompt).not.toContain('Language:');
    expect(prompt).not.toContain('Response Style:');
    expect(prompt).not.toContain('## Agent Goals');
    expect(prompt).not.toContain('## Domain Rules');
    expect(prompt).not.toContain('## Examples');
  });
});


