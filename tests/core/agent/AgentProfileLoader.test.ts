import { describe, it, expect } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { AgentProfileLoader } from '../../../core/agent/AgentProfileLoader';

describe('AgentProfileLoader', () => {

  describe('validate', () => {
    it('should accept a valid minimal profile', () => {
      const valid = {
        id: 'test',
        name: 'test agent',
        description: 'test description',
        persona: {
          systemInstructions: 'do test'
        }
      };
      const result = AgentProfileLoader.validate(valid, 'source');
      expect(result.id).toBe('test');
    });

    it('should reject non-object raw', () => {
      expect(() => AgentProfileLoader.validate(null, 'source')).toThrow('not an object');
      expect(() => AgentProfileLoader.validate('string', 'source')).toThrow('not an object');
    });

    it('should reject missing required fields', () => {
      expect(() => AgentProfileLoader.validate({}, 'source')).toThrow('Missing required field "id"');
      expect(() => AgentProfileLoader.validate({ id: 'a' }, 'source')).toThrow('Missing required field "name"');
      expect(() => AgentProfileLoader.validate({ id: 'a', name: 'b' }, 'source')).toThrow('Missing required field "description"');
      expect(() => AgentProfileLoader.validate({ id: 'a', name: 'b', description: 'c' }, 'source')).toThrow('Missing or invalid field "persona"');
      expect(() => AgentProfileLoader.validate({ id: 'a', name: 'b', description: 'c', persona: {} }, 'source')).toThrow('Missing required field "persona.systemInstructions"');
    });

    it('should reject invalid string arrays', () => {
       const valid = {
        id: 'test',
        name: 'test agent',
        description: 'test description',
        persona: { systemInstructions: 'do test' },
        goals: ['ok', 1]
      };
      expect(() => AgentProfileLoader.validate(valid, 'source')).toThrow('"goals" must be a string array');
    });

    it('should reject invalid examples', () => {
        const valid = {
          id: 'test',
          name: 'test agent',
          description: 'test description',
          persona: { systemInstructions: 'do test' },
          examples: [{ userMessage: 'test' }] // Missing expectedAction
        };
        expect(() => AgentProfileLoader.validate(valid, 'source')).toThrow('"examples" items must have an "expectedAction" string');
    });
  });

  describe('loadFromFile', () => {
    it('should return null if file does not exist', () => {
      const result = AgentProfileLoader.loadFromFile('/nonexistent/path.json', '/nonexistent');
      expect(result).toBeNull();
    });

    it('should throw if path is outside workspace', () => {
       expect(() => AgentProfileLoader.loadFromFile('/etc/passwd', '/home/user/workspace')).toThrow('outside workspace');
    });

    it('should load a valid profile from tmpdir', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-profile-test-'));
      const profilePath = path.join(tempDir, 'profile.json');
      fs.writeFileSync(profilePath, JSON.stringify({
         id: 'test-file',
         name: 'Test File Agent',
         description: 'A test file agent',
         persona: { systemInstructions: 'test file' }
      }));

      const result = AgentProfileLoader.loadFromFile(profilePath, tempDir);
      expect(result?.id).toBe('test-file');

      fs.rmSync(tempDir, { recursive: true, force: true });
    });

    it('should throw clear error on invalid JSON', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-profile-test-'));
      const profilePath = path.join(tempDir, 'profile.json');
      fs.writeFileSync(profilePath, '{ invalid json');

      expect(() => AgentProfileLoader.loadFromFile(profilePath, tempDir)).toThrow('Invalid JSON in');

      fs.rmSync(tempDir, { recursive: true, force: true });
    });
  });

  describe('loadById', () => {
     it('should reject invalid agentId', () => {
        expect(() => AgentProfileLoader.loadById('../evil', '/repo')).toThrow('Invalid agent id');
        expect(() => AgentProfileLoader.loadById('bad/id', '/repo')).toThrow('Invalid agent id');
     });

     it('should return null if profile does not exist', () => {
        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-repo-test-'));
        const result = AgentProfileLoader.loadById('missing', tempDir);
        expect(result).toBeNull();
        fs.rmSync(tempDir, { recursive: true, force: true });
     });

     it('should load a valid profile by id', () => {
        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-repo-test-'));
        const agentDir = path.join(tempDir, 'agents', 'my-agent');
        fs.mkdirSync(agentDir, { recursive: true });
        const profilePath = path.join(agentDir, 'profile.json');

        fs.writeFileSync(profilePath, JSON.stringify({
            id: 'my-agent',
            name: 'My Agent',
            description: 'My cool agent',
            persona: { systemInstructions: 'be cool' }
         }));

        const result = AgentProfileLoader.loadById('my-agent', tempDir);
        expect(result?.id).toBe('my-agent');

        fs.rmSync(tempDir, { recursive: true, force: true });
     });
  });
});
