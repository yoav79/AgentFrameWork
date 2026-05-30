#!/usr/bin/env node
import { CommandHandler } from './CommandHandler';
import { Renderer } from './Renderer';
import { AdapterFactory } from './AdapterFactory';
import { AgentFactory } from '../../core/agent/AgentFactory';

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
  
  const isAgentMode = args.includes('--agent');
  if (isAgentMode) {
    console.warn('\x1b[33mWarning: The --agent flag is deprecated and has no effect. Agent mode is now the default.\x1b[0m');
  }
  const isPersistMode = args.includes('--persist');
  
  let projectId;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--project') {
      projectId = args[i + 1];
    }
  }

  const agentKernel = AgentFactory.create(llmAdapter, {
    persist: isPersistMode,
    projectId: projectId
  });
  
  const handler = new CommandHandler(args, agentKernel, undefined);
  
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
