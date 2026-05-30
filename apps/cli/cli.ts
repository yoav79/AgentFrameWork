#!/usr/bin/env node
import { CommandHandler } from './CommandHandler';
import { Renderer } from './Renderer';
import { AdapterFactory } from './AdapterFactory';
import { Kernel } from '../../core/kernel/Kernel';

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
  
  const kernel = new Kernel({ llm: llmAdapter });
  
  const handler = new CommandHandler(args, kernel);
  
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
