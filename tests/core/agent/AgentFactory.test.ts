import { describe, it, expect } from 'vitest';
import { AgentFactory } from '../../../core/agent/AgentFactory';
import { LLMAdapter } from '../../../core/llm/LLMAdapter';
import { getNativeSkillActionTypes } from '../../../core/skills/NativeSkills';

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
    
    let callCount = 0;
    const llmAdapter = {
      generate: async () => {
        callCount++;
        if (callCount === 1) return { content: validJson };
        return {
          content: JSON.stringify({
            intent: 'respond',
            confidence: 1,
            proposedAction: { type: 'send_message', payload: { message: 'done' } }
          })
        };
      }
    } as any;
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

  it('should accept an AgentProfile in options and pass it to PromptBuilder', async () => {
    const profile = {
      id: 'comedian',
      name: 'JokeBot',
      description: 'funny agent',
      persona: {
        systemInstructions: 'Tell a joke about coding.'
      }
    };
    
    const llmAdapter = new MockLLMAdapter('{}');
    const kernel = AgentFactory.create(llmAdapter, { agentProfile: profile });
    expect(kernel).toBeDefined();

    // Access promptBuilder through kernel to verify it was instantiated with the profile
    const promptBuilder = (kernel as any).promptBuilder;
    expect(promptBuilder).toBeDefined();
    
    const context = { messageCount: 1 };
    const prompt = promptBuilder.build(context);
    expect(prompt).toContain('## Agent Identity');
    expect(prompt).toContain('Name: JokeBot');
    expect(prompt).toContain('funny agent');
    expect(prompt).toContain('Tell a joke about coding.');
    
    // Framework rules preserved
    expect(prompt).toContain('JSON Schema Expected');
    expect(prompt).toContain('Available Actions:');
    expect(prompt).toContain('Do NOT use \'none\' when the user is asking a question or expecting a response.');
  });

  it('should autodiscover profile.json in workspaceRoot if agentProfile is not explicitly provided', () => {
    const os = require('os');
    const path = require('path');
    const fs = require('fs');
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-factory-autodiscover-'));
    const profilePath = path.join(tempDir, 'profile.json');
    fs.writeFileSync(profilePath, JSON.stringify({
      id: 'auto-agent',
      name: 'AutoAgent',
      description: 'Discovered',
      persona: { systemInstructions: 'Do auto stuff' }
    }));

    const llmAdapter = new MockLLMAdapter('{}');
    const kernel = AgentFactory.create(llmAdapter, { workspaceRoot: tempDir });
    
    const promptBuilder = (kernel as any).promptBuilder;
    const prompt = promptBuilder.build({ messageCount: 1 });
    
    expect(prompt).toContain('Name: AutoAgent');
    expect(prompt).toContain('Do auto stuff');

    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('should prioritize explicitly provided agentProfile over workspaceRoot/profile.json', () => {
    const os = require('os');
    const path = require('path');
    const fs = require('fs');
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-factory-priority-'));
    const profilePath = path.join(tempDir, 'profile.json');
    fs.writeFileSync(profilePath, JSON.stringify({
      id: 'auto-agent',
      name: 'AutoAgent',
      description: 'Discovered',
      persona: { systemInstructions: 'Do auto stuff' }
    }));

    const explicitProfile = {
      id: 'explicit',
      name: 'ExplicitAgent',
      description: 'Explicit',
      persona: { systemInstructions: 'Do explicit stuff' }
    };

    const llmAdapter = new MockLLMAdapter('{}');
    const kernel = AgentFactory.create(llmAdapter, { 
      workspaceRoot: tempDir,
      agentProfile: explicitProfile
    });
    
    const promptBuilder = (kernel as any).promptBuilder;
    const prompt = promptBuilder.build({ messageCount: 1 });
    
    expect(prompt).toContain('Name: ExplicitAgent');
    expect(prompt).toContain('Do explicit stuff');
    expect(prompt).not.toContain('Name: AutoAgent');

    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('should fail with descriptive error if workspaceRoot/profile.json is invalid', () => {
    const os = require('os');
    const path = require('path');
    const fs = require('fs');
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-factory-invalid-'));
    const profilePath = path.join(tempDir, 'profile.json');
    fs.writeFileSync(profilePath, '{ invalid json');

    const llmAdapter = new MockLLMAdapter('{}');
    
    expect(() => {
      AgentFactory.create(llmAdapter, { workspaceRoot: tempDir });
    }).toThrow('Invalid JSON in');

    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('Plugin Filtering by AgentProfile', () => {
    it('should maintain current behavior if enabledPlugins is undefined', () => {
      const explicitProfile = {
        id: 'explicit',
        name: 'Explicit',
        description: 'Explicit',
        persona: { systemInstructions: 'Do explicit stuff' }
      };
      const llmAdapter = new MockLLMAdapter('{}');
      const kernel = AgentFactory.create(llmAdapter, { agentProfile: explicitProfile });
      const actionCatalog = (kernel as any).promptBuilder.actionCatalog;
      
      expect(actionCatalog.getActionTypes()).toContain('read_file');
    });

    it('should not load external plugins if enabledPlugins is empty array', () => {
      const explicitProfile = {
        id: 'explicit',
        name: 'Explicit',
        description: 'Explicit',
        persona: { systemInstructions: 'Do explicit stuff' },
        enabledPlugins: []
      };
      const llmAdapter = new MockLLMAdapter('{}');
      const kernel = AgentFactory.create(llmAdapter, { agentProfile: explicitProfile });
      const actionCatalog = (kernel as any).promptBuilder.actionCatalog;
      
      expect(actionCatalog.getActionTypes()).not.toContain('read_file');
      expect(actionCatalog.getActionTypes()).toContain('send_message');
      
      const prompt = (kernel as any).promptBuilder.build({ messageCount: 1 });
      expect(prompt).not.toContain('read_file\n   -');
    });

    it('should load only allowed plugins if enabledPlugins is provided', () => {
      const os = require('os');
      const path = require('path');
      const fs = require('fs');
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-factory-plugins-'));
      const configPath = path.join(tempDir, 'agent.config.json');
      fs.writeFileSync(configPath, JSON.stringify({
        plugins: {
          read_file: { enabled: true },
          write_file: { enabled: true }
        }
      }));

      const explicitProfile = {
        id: 'explicit',
        name: 'Explicit',
        description: 'Explicit',
        persona: { systemInstructions: 'Do explicit stuff' },
        enabledPlugins: ['read_file']
      };

      const llmAdapter = new MockLLMAdapter('{}');
      const kernel = AgentFactory.create(llmAdapter, { 
        workspaceRoot: tempDir,
        agentProfile: explicitProfile 
      });
      const actionCatalog = (kernel as any).promptBuilder.actionCatalog;
      
      expect(actionCatalog.getActionTypes()).toContain('read_file');
      expect(actionCatalog.getActionTypes()).not.toContain('write_file');
      
      const prompt = (kernel as any).promptBuilder.build({ messageCount: 1 });
      expect(prompt).toContain('\n4. read_file\n');
      expect(prompt).not.toContain('write_file\n   -');

      fs.rmSync(tempDir, { recursive: true, force: true });
    });

    it('should throw fatal error if enabledPlugins references unknown plugin', () => {
      const explicitProfile = {
        id: 'explicit',
        name: 'Explicit',
        description: 'Explicit',
        persona: { systemInstructions: 'Do explicit stuff' },
        enabledPlugins: ['inventado']
      };
      const llmAdapter = new MockLLMAdapter('{}');
      expect(() => {
        AgentFactory.create(llmAdapter, { agentProfile: explicitProfile });
      }).toThrow('[AgentFactory] AgentProfile references unknown plugin: inventado');
    });

    it('should throw fatal error if enabledPlugins references disabled plugin', () => {
      const os = require('os');
      const path = require('path');
      const fs = require('fs');
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-factory-plugins-disabled-'));
      const configPath = path.join(tempDir, 'agent.config.json');
      fs.writeFileSync(configPath, JSON.stringify({
        plugins: {
          read_file: { enabled: false }
        }
      }));

      const explicitProfile = {
        id: 'explicit',
        name: 'Explicit',
        description: 'Explicit',
        persona: { systemInstructions: 'Do explicit stuff' },
        enabledPlugins: ['read_file']
      };

      const llmAdapter = new MockLLMAdapter('{}');
      
      expect(() => {
        AgentFactory.create(llmAdapter, { 
          workspaceRoot: tempDir,
          agentProfile: explicitProfile 
        });
      }).toThrow('[AgentFactory] AgentProfile references disabled plugin: read_file');

      fs.rmSync(tempDir, { recursive: true, force: true });
    });
  });

  describe('Skill Filtering by AgentProfile (allowedSkills)', () => {
    it('maintains current behavior if allowedSkills is undefined (registers ask_clarification, send_message, none)', () => {
      const explicitProfile = {
        id: 'explicit',
        name: 'Explicit',
        description: 'Explicit',
        persona: { systemInstructions: 'Do explicit stuff' }
      };
      const llmAdapter = new MockLLMAdapter('{}');
      const kernel = AgentFactory.create(llmAdapter, { agentProfile: explicitProfile });
      const actionCatalog = (kernel as any).promptBuilder.actionCatalog;
      
      expect(actionCatalog.getActionTypes()).toContain('send_message');
      expect(actionCatalog.getActionTypes()).toContain('none');
      expect(actionCatalog.getActionTypes()).toContain('ask_clarification');

      const registry = (kernel as any).actionExecutor.registry;
      expect(registry.getSkillForAction('send_message')).toBeDefined();
      expect(registry.getSkillForAction('ask_clarification')).toBeDefined();
      expect(registry.getSkillForAction('none')).toBeDefined();
    });

    it('shows send_message in Available Actions and does not show none or ask_clarification if allowedSkills=["send_message"]', () => {
      const explicitProfile = {
        id: 'explicit',
        name: 'Explicit',
        description: 'Explicit',
        persona: { systemInstructions: 'Do explicit stuff' },
        allowedSkills: ['send_message']
      };
      const llmAdapter = new MockLLMAdapter('{}');
      const kernel = AgentFactory.create(llmAdapter, { agentProfile: explicitProfile });
      
      const prompt = (kernel as any).promptBuilder.build({ messageCount: 1 });
      expect(prompt).toContain('1. send_message');
      expect(prompt).not.toContain('2. none');
      expect(prompt).not.toContain('ask_clarification');

      const registry = (kernel as any).actionExecutor.registry;
      expect(registry.getSkillForAction('send_message')).toBeDefined();
      expect(registry.getSkillForAction('ask_clarification')).toBeUndefined();
      expect(registry.getSkillForAction('none')).toBeUndefined();
    });

    it('shows ask_clarification and does not show send_message or none if allowedSkills=["ask_clarification"]', () => {
      const explicitProfile = {
        id: 'explicit',
        name: 'Explicit',
        description: 'Explicit',
        persona: { systemInstructions: 'Do explicit stuff' },
        allowedSkills: ['ask_clarification']
      };
      const llmAdapter = new MockLLMAdapter('{}');
      const kernel = AgentFactory.create(llmAdapter, { agentProfile: explicitProfile });
      
      const prompt = (kernel as any).promptBuilder.build({ messageCount: 1 });
      expect(prompt).toContain('1. ask_clarification');
      expect(prompt).not.toContain('send_message\n   -');
      expect(prompt).not.toContain('none\n   -');
      
      const registry = (kernel as any).actionExecutor.registry;
      expect(registry.getSkillForAction('send_message')).toBeUndefined();
      expect(registry.getSkillForAction('ask_clarification')).toBeDefined();
      expect(registry.getSkillForAction('none')).toBeUndefined();
    });

    it('shows none and does not show send_message or ask_clarification if allowedSkills=["none"]', () => {
      const explicitProfile = {
        id: 'explicit',
        name: 'Explicit',
        description: 'Explicit',
        persona: { systemInstructions: 'Do explicit stuff' },
        allowedSkills: ['none']
      };
      const llmAdapter = new MockLLMAdapter('{}');
      const kernel = AgentFactory.create(llmAdapter, { agentProfile: explicitProfile });
      
      const prompt = (kernel as any).promptBuilder.build({ messageCount: 1 });
      expect(prompt).not.toContain('\n1. send_message\n');
      expect(prompt).toContain('none');
      expect(prompt).not.toContain('ask_clarification');
      
      const registry = (kernel as any).actionExecutor.registry;
      expect(registry.getSkillForAction('send_message')).toBeUndefined();
      expect(registry.getSkillForAction('ask_clarification')).toBeUndefined();
      expect(registry.getSkillForAction('none')).toBeDefined();
    });

    it('fails with clear error if allowedSkills is empty array', () => {
      const explicitProfile = {
        id: 'explicit',
        name: 'Explicit',
        description: 'Explicit',
        persona: { systemInstructions: 'Do explicit stuff' },
        allowedSkills: []
      };
      const llmAdapter = new MockLLMAdapter('{}');
      
      expect(() => {
        AgentFactory.create(llmAdapter, { agentProfile: explicitProfile });
      }).toThrow('[AgentFactory] AgentProfile.allowedSkills cannot be empty in interactive agents.');
    });

    it('fails with clear error if allowedSkills has invalid skill', () => {
      const explicitProfile = {
        id: 'explicit',
        name: 'Explicit',
        description: 'Explicit',
        persona: { systemInstructions: 'Do explicit stuff' },
        allowedSkills: ['invalid_skill']
      };
      const llmAdapter = new MockLLMAdapter('{}');
      
      expect(() => {
        AgentFactory.create(llmAdapter, { agentProfile: explicitProfile });
      }).toThrow('[AgentFactory] AgentProfile references unknown base skill: invalid_skill');
    });

    it('should accept all skill action types from NativeSkills dynamically without throwing', () => {
      const actionTypes = getNativeSkillActionTypes();
      expect(actionTypes.length).toBeGreaterThan(0);
      
      const explicitProfile = {
        id: 'explicit',
        name: 'Explicit',
        description: 'Explicit',
        persona: { systemInstructions: 'Do explicit stuff' },
        allowedSkills: actionTypes
      };
      const llmAdapter = new MockLLMAdapter('{}');
      const kernel = AgentFactory.create(llmAdapter, { agentProfile: explicitProfile });
      expect(kernel).toBeDefined();

      const registry = (kernel as any).actionExecutor.registry;
      for (const type of actionTypes) {
        expect(registry.getSkillForAction(type)).toBeDefined();
      }
    });
  });

  describe('Tool Filtering by AgentProfile (allowedTools)', () => {
    it('maintains current behavior if allowedTools is undefined', () => {
      const os = require('os');
      const path = require('path');
      const fs = require('fs');
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-factory-tools-'));
      const configPath = path.join(tempDir, 'agent.config.json');
      fs.writeFileSync(configPath, JSON.stringify({
        plugins: { read_file: { enabled: true } }
      }));

      const explicitProfile = {
        id: 'explicit',
        name: 'Explicit',
        description: 'Explicit',
        persona: { systemInstructions: 'Do explicit stuff' },
        enabledPlugins: ['read_file']
      };

      const llmAdapter = new MockLLMAdapter('{}');
      const kernel = AgentFactory.create(llmAdapter, { 
        workspaceRoot: tempDir,
        agentProfile: explicitProfile 
      });
      const actionCatalog = (kernel as any).promptBuilder.actionCatalog;
      
      expect(actionCatalog.getActionTypes()).toContain('read_file');
      fs.rmSync(tempDir, { recursive: true, force: true });
    });

    it('does not register external tools if allowedTools is []', () => {
      const os = require('os');
      const path = require('path');
      const fs = require('fs');
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-factory-tools-empty-'));
      const configPath = path.join(tempDir, 'agent.config.json');
      fs.writeFileSync(configPath, JSON.stringify({
        plugins: { read_file: { enabled: true } }
      }));

      const explicitProfile = {
        id: 'explicit',
        name: 'Explicit',
        description: 'Explicit',
        persona: { systemInstructions: 'Do explicit stuff' },
        enabledPlugins: ['read_file'],
        allowedTools: []
      };

      const llmAdapter = new MockLLMAdapter('{}');
      const kernel = AgentFactory.create(llmAdapter, { 
        workspaceRoot: tempDir,
        agentProfile: explicitProfile 
      });
      const actionCatalog = (kernel as any).promptBuilder.actionCatalog;
      
      expect(actionCatalog.getActionTypes()).not.toContain('read_file');
      
      const toolRegistry = (kernel as any).actionExecutor.toolRegistry;
      expect(toolRegistry.getRegisteredTools().map((t: any) => t.name)).not.toContain('read_file');

      fs.rmSync(tempDir, { recursive: true, force: true });
    });

    it('registers only read_file and not write_file if allowedTools=["read_file"]', () => {
      const os = require('os');
      const path = require('path');
      const fs = require('fs');
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-factory-tools-filter-'));
      const configPath = path.join(tempDir, 'agent.config.json');
      fs.writeFileSync(configPath, JSON.stringify({
        plugins: { 
          read_file: { enabled: true },
          write_file: { enabled: true }
        }
      }));

      const explicitProfile = {
        id: 'explicit',
        name: 'Explicit',
        description: 'Explicit',
        persona: { systemInstructions: 'Do explicit stuff' },
        enabledPlugins: ['read_file', 'write_file'],
        allowedTools: ['read_file']
      };

      const llmAdapter = new MockLLMAdapter('{}');
      const kernel = AgentFactory.create(llmAdapter, { 
        workspaceRoot: tempDir,
        agentProfile: explicitProfile 
      });
      
      const actionCatalog = (kernel as any).promptBuilder.actionCatalog;
      expect(actionCatalog.getActionTypes()).toContain('read_file');
      expect(actionCatalog.getActionTypes()).not.toContain('write_file');

      const toolRegistry = (kernel as any).actionExecutor.toolRegistry;
      expect(toolRegistry.getRegisteredTools().map((t: any) => t.name)).toContain('read_file');
      expect(toolRegistry.getRegisteredTools().map((t: any) => t.name)).not.toContain('write_file');

      const prompt = (kernel as any).promptBuilder.build({ messageCount: 1 });
      expect(prompt).not.toContain('\n4. write_file\n');

      fs.rmSync(tempDir, { recursive: true, force: true });
    });

    it('fails with clear error if allowedTools references unknown tool', () => {
      const explicitProfile = {
        id: 'explicit',
        name: 'Explicit',
        description: 'Explicit',
        persona: { systemInstructions: 'Do explicit stuff' },
        allowedTools: ['magia']
      };
      const llmAdapter = new MockLLMAdapter('{}');
      
      expect(() => {
        AgentFactory.create(llmAdapter, { agentProfile: explicitProfile });
      }).toThrow('[PluginLoader] AgentProfile.allowedTools references unknown or disabled tool: magia');
    });

    it('fails with clear error if allowedTools requests a tool but its plugin is disabled', () => {
      const explicitProfile = {
        id: 'explicit',
        name: 'Explicit',
        description: 'Explicit',
        persona: { systemInstructions: 'Do explicit stuff' },
        enabledPlugins: [], // none enabled
        allowedTools: ['read_file']
      };
      const llmAdapter = new MockLLMAdapter('{}');
      
      expect(() => {
        AgentFactory.create(llmAdapter, { agentProfile: explicitProfile });
      }).toThrow('[PluginLoader] AgentProfile.allowedTools references unknown or disabled tool: read_file');
    });
  });
});
