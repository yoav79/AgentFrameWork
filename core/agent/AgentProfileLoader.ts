import * as fs from 'fs';
import * as path from 'path';
import { AgentProfile } from './AgentProfile';

export class AgentProfileLoader {
  public static validate(raw: unknown, source: string): AgentProfile {
    if (!raw || typeof raw !== 'object') {
      throw new Error(`[AgentProfileLoader] Invalid profile at ${source}: not an object`);
    }

    const p = raw as Record<string, unknown>;

    if (typeof p['id'] !== 'string' || p['id'].trim() === '') {
      throw new Error(`[AgentProfileLoader] Missing required field "id" in ${source}`);
    }
    if (typeof p['name'] !== 'string' || p['name'].trim() === '') {
      throw new Error(`[AgentProfileLoader] Missing required field "name" in ${source}`);
    }
    if (typeof p['description'] !== 'string' || p['description'].trim() === '') {
      throw new Error(`[AgentProfileLoader] Missing required field "description" in ${source}`);
    }

    const persona = p['persona'] as Record<string, unknown> | undefined;
    if (!persona || typeof persona !== 'object') {
      throw new Error(`[AgentProfileLoader] Missing or invalid field "persona" in ${source}`);
    }
    if (typeof persona['systemInstructions'] !== 'string' || persona['systemInstructions'].trim() === '') {
      throw new Error(`[AgentProfileLoader] Missing required field "persona.systemInstructions" in ${source}`);
    }

    // Optional string arrays validation
    const checkStringArray = (field: string) => {
      if (p[field] !== undefined) {
        if (!Array.isArray(p[field]) || !(p[field] as unknown[]).every(x => typeof x === 'string')) {
          throw new Error(`[AgentProfileLoader] "${field}" must be a string array in ${source}`);
        }
      }
    };

    checkStringArray('goals');
    checkStringArray('rules');
    checkStringArray('enabledPlugins');
    checkStringArray('allowedTools');
    checkStringArray('allowedSkills');

    if (p['examples'] !== undefined) {
      if (!Array.isArray(p['examples'])) {
        throw new Error(`[AgentProfileLoader] "examples" must be an array in ${source}`);
      }
      for (const ex of p['examples']) {
        if (!ex || typeof ex !== 'object') {
          throw new Error(`[AgentProfileLoader] "examples" items must be objects in ${source}`);
        }
        if (typeof (ex as any)['userMessage'] !== 'string') {
          throw new Error(`[AgentProfileLoader] "examples" items must have a "userMessage" string in ${source}`);
        }
        if (typeof (ex as any)['expectedAction'] !== 'string') {
          throw new Error(`[AgentProfileLoader] "examples" items must have an "expectedAction" string in ${source}`);
        }
      }
    }

    const safety = p['safety'] as Record<string, unknown> | undefined;
    if (safety !== undefined) {
      if (typeof safety !== 'object') {
         throw new Error(`[AgentProfileLoader] "safety" must be an object in ${source}`);
      }
      if (safety['blockedTopics'] !== undefined) {
         if (!Array.isArray(safety['blockedTopics']) || !(safety['blockedTopics'] as unknown[]).every(x => typeof x === 'string')) {
            throw new Error(`[AgentProfileLoader] "safety.blockedTopics" must be a string array in ${source}`);
         }
      }
      if (safety['minConfidenceOverride'] !== undefined) {
          if (typeof safety['minConfidenceOverride'] !== 'object' || Array.isArray(safety['minConfidenceOverride'])) {
             throw new Error(`[AgentProfileLoader] "safety.minConfidenceOverride" must be an object in ${source}`);
          }
      }
    }

    if (p['metadata'] !== undefined && (typeof p['metadata'] !== 'object' || Array.isArray(p['metadata']))) {
        throw new Error(`[AgentProfileLoader] "metadata" must be an object in ${source}`);
    }

    return p as unknown as AgentProfile;
  }

  public static loadFromFile(filePath: string, workspaceRoot: string): AgentProfile | null {
    const resolvedPath = path.resolve(filePath);
    const resolvedRoot = path.resolve(workspaceRoot);

    if (!resolvedPath.startsWith(resolvedRoot)) {
      throw new Error(`[AgentProfileLoader] Profile path is outside workspace: ${resolvedPath}`);
    }

    if (!fs.existsSync(resolvedPath)) {
      return null;
    }

    let raw;
    try {
      const content = fs.readFileSync(resolvedPath, 'utf-8');
      raw = JSON.parse(content);
    } catch (e: any) {
      throw new Error(`[AgentProfileLoader] Invalid JSON in ${resolvedPath}: ${e.message}`);
    }

    return this.validate(raw, resolvedPath);
  }

  public static loadById(agentId: string, repoRoot: string): AgentProfile | null {
    if (!/^[a-zA-Z0-9_-]+$/.test(agentId)) {
      throw new Error(`[AgentProfileLoader] Invalid agent id: ${agentId}`);
    }

    const resolvedRepoRoot = path.resolve(repoRoot);
    const agentsDir = path.join(resolvedRepoRoot, 'agents');
    const profilePath = path.join(agentsDir, agentId, 'profile.json');

    if (!profilePath.startsWith(agentsDir)) {
      // This should never happen due to regex validation, but just in case
      throw new Error(`[AgentProfileLoader] Profile path is outside agents directory: ${profilePath}`);
    }

    if (!fs.existsSync(profilePath)) {
      return null;
    }

    let raw;
    try {
      const content = fs.readFileSync(profilePath, 'utf-8');
      raw = JSON.parse(content);
    } catch (e: any) {
      throw new Error(`[AgentProfileLoader] Invalid JSON in ${profilePath}: ${e.message}`);
    }

    return this.validate(raw, profilePath);
  }
}
