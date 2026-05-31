import { Renderer } from './Renderer';
import { ProjectDirectoryAdapter } from './ProjectDirectoryAdapter';
import { AgentKernel } from '../../core/agent/AgentKernel';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { WorkspaceNameValidator } from '../../core/workspace/WorkspaceNameValidator';

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

  private createAgent: (projectId?: string, workspaceRoot?: string, sessionId?: string) => AgentKernel;

  constructor(args: string[], createAgent: (projectId?: string, workspaceRoot?: string, sessionId?: string) => AgentKernel, directoryAdapter?: ProjectDirectoryAdapter) {
    this.renderer = new Renderer();
    this.args = args;
    this.directoryAdapter = directoryAdapter || new ProjectDirectoryAdapter();
    this.createAgent = createAgent;
    
    // Parse initially to determine the initial projectId
    const parsedArgs = this.parseArgs(args);
    const root = parsedArgs.projectId ? this.directoryAdapter.getProjectPath(parsedArgs.projectId) : process.cwd();
    this.agentKernel = this.createAgent(parsedArgs.projectId, root, parsedArgs.sessionId);
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
        if (parsedArgs.debug && result.trace) {
          this.renderer.renderDebug('Execution Trace', result.trace);
        }
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
        i++; // skip value
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
      } else if (arg === '--max-steps') {
        i++; // skip value
      } else if (arg === '--max-tool-calls') {
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
      const pkgPath = path.join(__dirname, '../../package.json');
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      return pkg.version || '0.0.0';
    } catch {
      return 'unknown (fallback)';
    }
  }

  private async startInteractiveMode(parsedArgs: ParsedArgs): Promise<void> {
    const readline = await import('readline');
    
    let currentWorkspace = parsedArgs.projectId || null;
    let currentSession = parsedArgs.sessionId || 'default';

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
      rl.setPrompt(currentWorkspace ? `\x1b[0m${currentWorkspace} [${currentSession}] >> \x1b[30m` : '\x1b[0m>> \x1b[30m');
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
        process.stdout.write('\x1b[0m'); // Reset user black input style immediately
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

        if (inputLine.startsWith('/session')) {
          if (!currentWorkspace) {
            console.log('\x1b[33mNo estás en un workspace. Selecciona un workspace con "/use <workspace>" primero.\x1b[0m');
            rl.prompt();
            return;
          }

          const parts = inputLine.split(/\s+/);
          const subCommand = parts[1]; // list, active, create, use, delete
          const param = parts[2];

          const baseDir = path.join(os.homedir(), '.agentframework');
          const sessionsDir = path.join(baseDir, 'projects', currentWorkspace, 'sessions');

          if (!subCommand) {
            console.log(`\n\x1b[36mGestión de Sesiones para '${currentWorkspace}':\x1b[0m`);
            console.log(`  Sesión activa actual: ${currentSession}`);
            console.log(`\nUso de /session:`);
            console.log(`  /session list             - Listar todas las sesiones disponibles`);
            console.log(`  /session active           - Mostrar la sesión activa`);
            console.log(`  /session create <nombre>  - Crear y seleccionar una nueva sesión`);
            console.log(`  /session use <nombre>     - Seleccionar una sesión existente`);
            console.log(`  /session delete <nombre>  - Eliminar una sesión existente\n`);
            rl.prompt();
            return;
          }

          if (subCommand === 'list') {
            console.log(`\x1b[36mSesiones en '${currentWorkspace}':\x1b[0m`);
            if (fs.existsSync(sessionsDir)) {
              try {
                const files = fs.readdirSync(sessionsDir);
                const sessions = files.filter(f => f.endsWith('.json')).map(f => f.slice(0, -5));
                if (sessions.length > 0) {
                  sessions.forEach(s => {
                    const activeMark = (s === currentSession) ? ' (activa)' : '';
                    console.log(`- ${s}${activeMark}`);
                  });
                } else {
                  console.log('- default (activa)');
                }
              } catch (err) {
                console.log(`\x1b[31mError al leer sesiones: ${err instanceof Error ? err.message : String(err)}\x1b[0m`);
              }
            } else {
              console.log('- default (activa)');
            }
          } else if (subCommand === 'active') {
            console.log(`Sesión activa actual: \x1b[32m${currentSession}\x1b[0m`);
          } else if (subCommand === 'create') {
            if (!param) {
              console.log('\x1b[31mUso: /session create <nombre>\x1b[0m');
            } else {
              try {
                WorkspaceNameValidator.validate(param);
                const filePath = path.join(sessionsDir, `${param}.json`);
                if (fs.existsSync(filePath)) {
                  console.log(`\x1b[31mError: La sesión '${param}' ya existe.\x1b[0m`);
                } else {
                  if (!fs.existsSync(sessionsDir)) {
                    fs.mkdirSync(sessionsDir, { recursive: true });
                  }
                  fs.writeFileSync(filePath, '[]', 'utf-8');
                  currentSession = param;
                  parsedArgs.sessionId = param;
                  const root = this.directoryAdapter.getProjectPath(currentWorkspace);
                  this.agentKernel = this.createAgent(currentWorkspace, root, param);
                  updatePrompt();
                  console.log(`\x1b[32mSesión '${param}' creada y seleccionada.\x1b[0m`);
                }
              } catch (err: any) {
                console.log(`\x1b[31mError: ${err.message}\x1b[0m`);
              }
            }
          } else if (subCommand === 'use') {
            if (!param) {
              console.log('\x1b[31mUso: /session use <nombre>\x1b[0m');
            } else {
              try {
                WorkspaceNameValidator.validate(param);
                const filePath = path.join(sessionsDir, `${param}.json`);
                const exists = fs.existsSync(filePath) || (param === 'default');
                if (exists) {
                  currentSession = param;
                  parsedArgs.sessionId = param;
                  const root = this.directoryAdapter.getProjectPath(currentWorkspace);
                  this.agentKernel = this.createAgent(currentWorkspace, root, param);
                  updatePrompt();
                  console.log(`\x1b[32mCambiado a la sesión: '${param}'\x1b[0m`);
                } else {
                  console.log(`\x1b[31mError: La sesión '${param}' no existe. Usa '/session create ${param}' para crearla.\x1b[0m`);
                }
              } catch (err: any) {
                console.log(`\x1b[31mError: ${err.message}\x1b[0m`);
              }
            }
          } else if (subCommand === 'delete') {
            if (!param) {
              console.log('\x1b[31mUso: /session delete <nombre>\x1b[0m');
            } else {
              try {
                WorkspaceNameValidator.validate(param);
                const filePath = path.join(sessionsDir, `${param}.json`);
                if (fs.existsSync(filePath)) {
                  fs.unlinkSync(filePath);
                  console.log(`\x1b[32mSesión '${param}' eliminada.\x1b[0m`);
                  if (currentSession === param) {
                    currentSession = 'default';
                    parsedArgs.sessionId = 'default';
                    const root = this.directoryAdapter.getProjectPath(currentWorkspace);
                    this.agentKernel = this.createAgent(currentWorkspace, root, 'default');
                    updatePrompt();
                    console.log(`\x1b[33mCambiado automáticamente a la sesión 'default'.\x1b[0m`);
                  }
                } else {
                  console.log(`\x1b[31mError: La sesión '${param}' no existe.\x1b[0m`);
                }
              } catch (err: any) {
                console.log(`\x1b[31mError: ${err.message}\x1b[0m`);
              }
            }
          } else {
            console.log(`\x1b[31mSubcomando desconocido: ${subCommand}. Usa /session para ver opciones.\x1b[0m`);
          }
          rl.prompt();
          return;
        }

        if (inputLine === '/close') {
          if (currentWorkspace) {
            currentWorkspace = null;
            currentSession = 'default';
            parsedArgs.projectId = undefined;
            parsedArgs.sessionId = undefined;
            this.agentKernel = this.createAgent(undefined, process.cwd(), undefined);
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
            try {
              WorkspaceNameValidator.validate(target);
              currentWorkspace = target;
              currentSession = 'default';
              parsedArgs.projectId = target; // update context
              parsedArgs.sessionId = 'default';
              const root = this.directoryAdapter.getProjectPath(target);
              this.agentKernel = this.createAgent(target, root, 'default');
              updatePrompt();
              console.log(`\x1b[32mEntrando al workspace: ${currentWorkspace}\x1b[0m`);
            } catch (error: any) {
              console.log(`\x1b[31mError: ${error.message}\x1b[0m`);
            }
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
              currentSession = 'default';
              parsedArgs.projectId = target; // update context
              parsedArgs.sessionId = 'default';
              const root = this.directoryAdapter.getProjectPath(target);
              this.agentKernel = this.createAgent(target, root, 'default');
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
        try {
          rl.prompt();
        } catch (e: any) {
          if (e.code !== 'ERR_USE_AFTER_CLOSE') throw e;
        }
      }).on('close', () => {
        process.stdout.write('\x1b[0m\n');
        resolve();
      });
    });
  }
}
