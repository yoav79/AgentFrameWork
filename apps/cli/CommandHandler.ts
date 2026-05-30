import { Renderer } from './Renderer';
import { ProjectDirectoryAdapter } from './ProjectDirectoryAdapter';
import { AgentKernel } from '../../core/agent/AgentKernel';
import { join } from 'path';
import { readFileSync } from 'fs';

interface ParsedArgs {
  help: boolean;
  version: boolean;
  debug: boolean;
  projectId?: string;
  sessionId?: string;
  message?: string;
}

export class CommandHandler {
  private renderer: Renderer;
  private directoryAdapter: ProjectDirectoryAdapter;
  private args: string[];
  private agentKernel: AgentKernel;

  constructor(args: string[], agentKernel: AgentKernel, directoryAdapter?: ProjectDirectoryAdapter) {
    this.renderer = new Renderer();
    this.args = args;
    this.directoryAdapter = directoryAdapter || new ProjectDirectoryAdapter();
    this.agentKernel = agentKernel;
  }

  public async execute(): Promise<void> {
    try {
      const parsedArgs = this.parseArgs(this.args);

      if (parsedArgs.help) {
        this.renderer.renderHelp();
        return;
      }

      if (parsedArgs.version) {
        this.renderer.renderVersion(this.getVersion());
        return;
      }

      if (!parsedArgs.message) {
        await this.startInteractiveMode(parsedArgs);
        return;
      }

      if (parsedArgs.message.trim() === '') {
        this.renderer.renderError(new Error('Execution context input cannot be empty.'), parsedArgs.debug);
        return;
      }

      if (parsedArgs.debug) {
        this.renderer.renderDebug('Parsed arguments', parsedArgs);
      }

      try {
        let result;
        if (parsedArgs.debug) {
          this.renderer.renderDebug('Sending input to agent kernel', {
            input: parsedArgs.message,
            projectId: parsedArgs.projectId,
            sessionId: parsedArgs.sessionId
          });
        }
        this.renderer.startSpinner();
        result = await this.agentKernel.run({
          input: parsedArgs.message as string,
          projectId: parsedArgs.projectId,
          sessionId: parsedArgs.sessionId
        });
        this.renderer.stopSpinner();
        this.renderer.renderResponse(result);
        if (!result.success) {
          process.exitCode = 1;
        }
      } catch (kernelError) {
        this.renderer.stopSpinner();
        this.renderer.renderError(kernelError as Error, parsedArgs.debug);
      }

    } catch (error) {
      const debug = this.args.includes('--debug');
      this.renderer.renderError(error as Error, debug);
      process.exitCode = 1;
    }
  }

  private parseArgs(args: string[]): ParsedArgs {
    const result: ParsedArgs = {
      help: false,
      version: false,
      debug: false,
    };

    const positional: string[] = [];

    for (let i = 0; i < args.length; i++) {
      const arg = args[i]!;
      if (arg === '--help') {
        result.help = true;
      } else if (arg === '--version') {
        result.version = true;
      } else if (arg === '--debug') {
        result.debug = true;
      } else if (arg === '--agent') {
        // Just flag, don't add to positional
      } else if (arg === '--persist') {
        // Just flag, don't add to positional
      } else if (arg === '--project') {
        result.projectId = args[++i];
      } else if (arg === '--session') {
        result.sessionId = args[++i];
      } else if (arg === '--llm') {
        i++; // skip value
      } else if (arg === '--model') {
        i++; // skip value
      } else if (arg === '--api-key') {
        i++; // skip value
      } else if (!arg.startsWith('-')) {
        positional.push(arg);
      }
    }

    if (positional.length > 0) {
      result.message = positional.join(' ');
    }

    return result;
  }

  private getVersion(): string {
    try {
      // Find package.json from the apps/cli directory relative to project root
      const pkgPath = join(__dirname, '../../package.json');
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
      return pkg.version || '0.0.0';
    } catch {
      return 'unknown (fallback)';
    }
  }

  private async startInteractiveMode(parsedArgs: ParsedArgs): Promise<void> {
    const readline = await import('readline');
    
    let currentWorkspace = parsedArgs.projectId || null;

    const completer = (line: string) => {
      // Autocompletado específico para /use
      if (!currentWorkspace && line.startsWith('/use ')) {
        const availableWorkspaces = this.directoryAdapter.listProjects();
        const prefix = line.slice(5);
        const hits = availableWorkspaces.filter(w => w.startsWith(prefix));
        return [hits.length ? hits : availableWorkspaces, prefix];
      }

      // Autocompletado general dependiente del contexto
      let completions: string[] = [];
      if (currentWorkspace) {
        completions = ['/help', '/close', '/session', '/exit'];
      } else {
        completions = ['/help', '/exit', '/use', '/create', '/list', '/version', '/debug'];
      }
      
      const hits = completions.filter((c) => c.startsWith(line));
      return [hits.length ? hits : completions, line];
    };

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      completer: completer,
      terminal: true,
      historySize: 100
    });

    const updatePrompt = () => {
      rl.setPrompt(currentWorkspace ? `${currentWorkspace} >> ` : '>> ');
    };
    updatePrompt();

    this.renderer.renderVersion(this.getVersion());
    if (currentWorkspace) {
      console.log(`Modo interactivo iniciado en el workspace: ${currentWorkspace}. Escribe "/exit" para salir.\n`);
    } else {
      console.log('Modo global iniciado. No hay workspace seleccionado.\nUsa "/use <workspace>" para seleccionar uno, o "/help" para ver opciones.\n');
    }
    rl.prompt();

    return new Promise((resolve) => {
      rl.on('line', async (line) => {
        const inputLine = line.trim();
        if (inputLine === '/exit') {
          rl.close();
          return;
        }

        if (inputLine === '/help') {
          this.renderer.renderHelp(!!currentWorkspace);
          rl.prompt();
          return;
        }

        if (inputLine === '/version') {
          this.renderer.renderVersion(this.getVersion());
          rl.prompt();
          return;
        }

        if (inputLine === '/list') {
          const workspacesList = this.directoryAdapter.listProjects();

          console.log('\x1b[36mWorkspaces disponibles:\x1b[0m');
          if (workspacesList.length > 0) {
            workspacesList.forEach(w => {
              const activeMark = (w === currentWorkspace) ? ' (activo)' : '';
              console.log(`- ${w}${activeMark}`);
            });
          } else {
            console.log('No hay workspaces creados aún.');
          }
          rl.prompt();
          return;
        }

        if (inputLine === '/session') {
          console.log('\x1b[36mGestión de sesiones: (No implementado - simulando)\x1b[0m');
          console.log(`- Sesión actual: ${parsedArgs.sessionId || 'Ninguna'}`);
          rl.prompt();
          return;
        }

        if (inputLine === '/close') {
          if (currentWorkspace) {
            currentWorkspace = null;
            parsedArgs.projectId = undefined;
            updatePrompt();
            console.log('\x1b[32mWorkspace cerrado. Has regresado al contexto global.\x1b[0m');
          } else {
            console.log('\x1b[33mNo estás en un workspace. Usa /help para ver los comandos globales.\x1b[0m');
          }
          rl.prompt();
          return;
        }

        if (inputLine === '/debug') {
          parsedArgs.debug = !parsedArgs.debug;
          console.log(`\x1b[33mModo debug ${parsedArgs.debug ? 'activado' : 'desactivado'}.\x1b[0m`);
          rl.prompt();
          return;
        }

        if (!currentWorkspace && inputLine.startsWith('/use')) {
          const target = inputLine.slice(4).trim();
          if (target) {
            currentWorkspace = target;
            parsedArgs.projectId = target; // update context
            updatePrompt();
            console.log(`\x1b[32mEntrando al workspace: ${currentWorkspace}\x1b[0m`);
          } else {
            console.log(`\x1b[31mUso: /use <workspace>\x1b[0m`);
          }
          rl.prompt();
          return;
        }

        if (!currentWorkspace && inputLine.startsWith('/create')) {
          const target = inputLine.slice(7).trim();
          if (target) {
            if (this.directoryAdapter.projectExists(target)) {
              console.log(`\x1b[31mError: El workspace '${target}' ya existe.\x1b[0m`);
            } else {
              this.directoryAdapter.createProject(target);
              currentWorkspace = target;
              parsedArgs.projectId = target; // update context
              updatePrompt();
              console.log(`\x1b[32mWorkspace '${currentWorkspace}' creado y seleccionado.\x1b[0m`);
            }
          } else {
            console.log(`\x1b[31mUso: /create <workspace>\x1b[0m`);
          }
          rl.prompt();
          return;
        }

        if (inputLine.startsWith('/')) {
           console.log(`\x1b[31mComando desconocido: ${inputLine}\x1b[0m`);
           rl.prompt();
           return;
        }

        if (inputLine) {
          if (!currentWorkspace) {
            console.log('\x1b[33mNo estás en un workspace. Usa "/use <workspace>" antes de enviar mensajes o "/help".\x1b[0m');
            rl.prompt();
            return;
          }

          try {
            let result;
            if (parsedArgs.debug) {
              this.renderer.renderDebug('Sending input to agent kernel', {
                input: inputLine,
                projectId: parsedArgs.projectId,
                sessionId: parsedArgs.sessionId
              });
            }
            this.renderer.startSpinner();
            result = await this.agentKernel.run({
              input: inputLine,
              projectId: parsedArgs.projectId,
              sessionId: parsedArgs.sessionId
            });
            this.renderer.stopSpinner();
            this.renderer.renderResponse(result);
          } catch (error) {
            this.renderer.stopSpinner();
            this.renderer.renderError(error as Error, parsedArgs.debug);
          }
        }
        rl.prompt();
      }).on('close', () => {
        resolve();
      });
    });
  }
}
