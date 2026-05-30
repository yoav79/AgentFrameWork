import { describe, it, expect } from 'vitest';
import { AgentFactory } from '../../../core/agent/AgentFactory';
import { LLMAdapter } from '../../../core/llm/LLMAdapter';

class MockLLMAdapter implements LLMAdapter {
  constructor(public responseContent: string) {}
  async generate() {
    return { content: this.responseContent };
  }
}

describe('AgentFactory', () => {
  it('should create an AgentKernel instance', () => {
    const llmAdapter = new MockLLMAdapter('{}');
    const kernel = AgentFactory.create(llmAdapter);
    expect(kernel).toBeDefined();
    expect(typeof kernel.run).toBe('function');
  });

  it('should successfully register SendMessageSkill and execute a simple flow', async () => {
    const validJson = JSON.stringify({
      intent: 'respond',
      confidence: 1,
      proposedAction: { type: 'send_message', payload: { message: 'hello from factory' } }
    });
    const llmAdapter = new MockLLMAdapter(validJson);
    const kernel = AgentFactory.create(llmAdapter);

    const result = await kernel.run({ input: 'test' });
    expect(result.success).toBe(true);
    expect(result.result?.message).toBe('hello from factory');
  });
  it('should use EventLogFactory options correctly', () => {
    const llmAdapter = new MockLLMAdapter('{}');
    // Using persist false
    const kernelMem = AgentFactory.create(llmAdapter, { persist: false });
    expect(kernelMem).toBeDefined();

    // Using persist true with tmpdir
    const os = require('os');
    const path = require('path');
    const fs = require('fs');
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-factory-test-'));
    
    const kernelPersist = AgentFactory.create(llmAdapter, { persist: true, baseDir: tempDir });
    expect(kernelPersist).toBeDefined();
    expect(fs.existsSync(path.join(tempDir, 'global', 'events.json'))).toBe(true);
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('should register ReadFileTool with workspaceRoot and execute read_file', async () => {
    const os = require('os');
    const path = require('path');
    const fs = require('fs');
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-factory-read-test-'));
    const testFile = path.join(tempDir, 'test.txt');
    fs.writeFileSync(testFile, 'file content from factory test', 'utf-8');

    const validJson = JSON.stringify({
      intent: 'respond',
      confidence: 1,
      proposedAction: { type: 'read_file', payload: { path: 'test.txt' } }
    });
    
    const llmAdapter = new MockLLMAdapter(validJson);
    const kernel = AgentFactory.create(llmAdapter, { workspaceRoot: tempDir });

    const result = await kernel.run({ input: 'read test.txt' });
    expect(result.success).toBe(true);
    expect(result.result?.data?.content).toBe('file content from factory test');
    expect(result.result?.data?.path).toBe('test.txt');

    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('should fail cleanly if read_file target does not exist', async () => {
    const os = require('os');
    const path = require('path');
    const fs = require('fs');
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-factory-read-fail-'));

    const validJson = JSON.stringify({
      intent: 'respond',
      confidence: 1,
      proposedAction: { type: 'read_file', payload: { path: 'missing.txt' } }
    });
    
    const llmAdapter = new MockLLMAdapter(validJson);
    const kernel = AgentFactory.create(llmAdapter, { workspaceRoot: tempDir });

    const result = await kernel.run({ input: 'read missing.txt' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('File does not exist');

    fs.rmSync(tempDir, { recursive: true, force: true });
  });
});
