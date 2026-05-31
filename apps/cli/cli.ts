#!/usr/bin/env node
import * as path from 'path';
import { CommandHandler } from './CommandHandler';
import { Renderer } from './Renderer';
import { ProjectDirectoryAdapter } from './ProjectDirectoryAdapter';
import { AdapterFactory } from './AdapterFactory';
import { AgentFactory } from '../../core/agent/AgentFactory';
import { AgentProfile } from '../../core/agent/AgentProfile';
import { AgentProfileLoader } from '../../core/agent/AgentProfileLoader';
import { WorkspaceNameValidator } from '../../core/workspace/WorkspaceNameValidator';

async function bootstrap() {
  const args = process.argv.slice(2);
  
  let llmAdapter;
  try {
    llmAdapter = AdapterFactory.createAdapter(args);
  } catch (error) {
    const renderer = new Renderer();
    renderer.renderError(error as Error, args.includes('--debug'));
    process.exit(1);
  }
  
  const isPersistMode = args.includes('--persist');
  
  let projectId;
  let agentId;
  let maxSteps = 2;
  let maxToolCalls = 1;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--project') {
      projectId = args[i + 1];
    }
    if (args[i] === '--agent') {
      agentId = args[i + 1];
      if (!agentId || agentId.startsWith('-')) {
        const renderer = new Renderer();
        renderer.renderError(new Error('Agent id is required after --agent'), args.includes('--debug'));
        process.exit(1);
      }
    }
    if (args[i] === '--max-steps') {
      const val = args[i + 1];
      if (val !== undefined) {
        maxSteps = parseInt(val, 10);
      }
    }
    if (args[i] === '--max-tool-calls') {
      const val = args[i + 1];
      if (val !== undefined) {
        maxToolCalls = parseInt(val, 10);
      }
    }
  }

  if (projectId) {
    try {
      WorkspaceNameValidator.validate(projectId);
    } catch (error) {
      const renderer = new Renderer();
      renderer.renderError(error as Error, args.includes('--debug'));
      process.exit(1);
    }
  }

  let agentProfile: AgentProfile | undefined;
  if (agentId) {
    try {
      const repoRoot = path.resolve(__dirname, '../../');
      const loaded = AgentProfileLoader.loadById(agentId, repoRoot);
      if (!loaded) {
        throw new Error(`Agent profile not found: ${agentId}`);
      }
      agentProfile = loaded;
    } catch (error) {
      const renderer = new Renderer();
      renderer.renderError(error as Error, args.includes('--debug'));
      process.exit(1);
    }
  }

  const directoryAdapter = new ProjectDirectoryAdapter();

  const createAgent = (id?: string, root?: string, sessionId?: string) => AgentFactory.create(llmAdapter, {
    persist: isPersistMode,
    projectId: id,
    sessionId: sessionId,
    workspaceRoot: root ?? (id ? directoryAdapter.getProjectPath(id) : process.cwd()),
    debug: args.includes('--debug'),
    agentProfile: agentProfile,
    flowConfig: {
      maxSteps,
      maxToolCalls,
      stopOnPolicyRejection: true,
      stopOnToolError: true,
      allowRetries: false,
      maxRetries: 0
    }
  });
  
  const handler = new CommandHandler(args, createAgent, directoryAdapter);
  
  try {
    await handler.execute();
  } catch (error) {
    // Fatal errors outside CommandHandler's own try-catch block
    const renderer = new Renderer();
    renderer.renderError(error as Error, args.includes('--debug'));
    process.exit(1);
  }
}

bootstrap();
