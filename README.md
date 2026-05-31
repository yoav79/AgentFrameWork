# AgentFrameWork

AgentFrameWork es un framework modular y desacoplado en TypeScript/Node.js para construir aplicaciones agénticas. Su objetivo es proporcionar una base sólida separando la orquestación interactiva (CLI) del núcleo agnóstico (Core) que maneja contextos, inyección de LLMs y normalización de respuestas.

## Estado Actual
El sistema está en desarrollo activo. Actualmente soporta enrutamiento de línea de comandos, inyección dinámica de proveedores LLM (`mock` y `openai`), y gestión de contexto básico. Varias características agénticas avanzadas (memoria, herramientas, a2a) están en fase de diseño como módulos reservados.

## Instalación

1. Clona el repositorio.
2. Instala las dependencias:
   ```bash
   npm install
   ```

## Desarrollo y Comandos Disponibles

El proyecto utiliza `tsx` para la ejecución de TypeScript en tiempo real.

- **Ejecutar el CLI:**
  ```bash
  npm run dev
  ```
- **Correr Tests (Unitarios):**
  ```bash
  npm test
  # Opcionalmente para ejecución directa con vitest:
  npx vitest run
  ```
- **Verificación Estricta de Tipos:**
  ```bash
  npm run typecheck
  ```

## Uso del CLI

El framework proporciona una interfaz de línea de comandos rica que opera en dos modos: "One-off" e "Interactivo", impulsada nativamente por el motor `AgentKernel`.

### Modo One-off
Permite ejecutar una única consulta al agente y recibir la respuesta, terminando el proceso de inmediato.
```bash
npx tsx apps/cli/cli.ts "Hola, ¿cómo estás?"
```

### Modo Interactivo (REPL)
Inicia un entorno conversacional continuo si no se provee un mensaje directo.
```bash
npx tsx apps/cli/cli.ts
```

### Motor Agéntico y Persistencia
El sistema utiliza el `AgentKernel` por defecto, proveyendo memoria contextual histórica e integración con el `EventLogFactory`. Si deseas persistir los eventos entre ejecuciones (en el disco local dentro de `~/.agentframework` o en la carpeta `projects/`), añade `--persist`.
```bash
npx tsx apps/cli/cli.ts --persist
```
*Nota: La bandera `--agent` está obsoleta (deprecated) y se mantiene únicamente por compatibilidad sin tener ningún efecto adicional.*

### Selección de Proveedor LLM

Por defecto, el CLI usa un proveedor `mock` seguro que no consume recursos de red. Puedes cambiar dinámicamente a `openai` usando banderas.

### Perfiles de Agente
Puedes utilizar la bandera `--agent <id>` para instanciar el sistema con comportamientos preconfigurados y restricciones granulares. Consulta la [Documentación de Agent Profiles](docs/AGENT_PROFILES.md) para aprender a construir tus propios agentes.

> **⚠️ Advertencia de Seguridad:** Evita escribir o pegar tus API Keys reales en comandos directos para prevenir que queden registradas en el historial de bash (`~/.bash_history`). Usa variables de entorno cuando sea posible o asegúrate de limpiar tu historial.

**Usando Mock (Por defecto):**
```bash
npx tsx apps/cli/cli.ts --llm mock "Simula una respuesta"
```

**Usando OpenAI:**
*Nota: Requiere una API Key válida. El modelo por defecto si no se especifica es `gpt-4o-mini`.*

**Forma recomendada (Variable de Entorno):**
Exporta tu llave y modelo en el entorno antes de correr el CLI. Esto evita que la llave quede en el historial de tu shell.
```bash
export OPENAI_API_KEY="sk-tu-llave-secreta"
export OPENAI_MODEL="gpt-4o" # Opcional, por defecto es gpt-4o-mini
npx tsx apps/cli/cli.ts --llm openai "Genera un texto real"
```

**Forma alternativa (Flag CLI):**
```bash
npx tsx apps/cli/cli.ts --llm openai --api-key "sk-tu-llave-secreta" "Genera un texto real"
```

**Especificando un modelo concreto:**
```bash
npx tsx apps/cli/cli.ts --llm openai --model gpt-4 "Usa GPT-4"
```

### Tabla de Flags CLI

| Flag | Descripción | Default |
|---|---|---|
| `--llm <provider>` | Proveedor de LLM a usar (`mock`, `openai`). | `mock` |
| `--model <id>` | ID del modelo a usar (aplica para `openai`). | `gpt-4o-mini` |
| `--api-key <key>` | Clave de acceso para la API de OpenAI. Alternativamente, usar `OPENAI_API_KEY`. | N/A |
| `--project <id>` | ID del proyecto/workspace a usar en el contexto. Sujeto a reglas de seguridad. | N/A |
| `--session <id>` | ID de la sesión a utilizar. | N/A |
| `--agent` | (Obsoleto) Alias sin efecto. `AgentKernel` es ahora el predeterminado. | N/A |
| `--persist` | Habilita la persistencia de memoria en el sistema de archivos. | `false` |
| `--debug` | Habilita la impresión de mensajes de depuración en consola. | `false` |
| `--help` | Muestra la ayuda estática. | N/A |
| `--version` | Muestra la versión actual del `package.json`. | N/A |

### Tabla de Comandos Interactivos

Dentro del modo REPL, puedes usar los siguientes comandos especiales:

| Comando | Descripción | Estado |
|---|---|---|
| `/help` | Muestra la ayuda de comandos. | Implementado |
| `/version` | Muestra la versión del framework. | Implementado |
| `/debug` | Alterna el modo de depuración de la sesión actual. | Implementado |
| `/list` | Lista los workspaces (proyectos) disponibles. | Simulado |
| `/create <name>` | Crea un nuevo workspace en la carpeta `projects/`. | Implementado |
| `/use <name>` | Entra al contexto de un workspace. | Implementado |
| `/close` | Sale del contexto del workspace actual. | Implementado |
| `/session` | Muestra información de la sesión actual. | Simulado |
| `/exit` | Cierra el CLI. | Implementado |

### Seguridad en Workspaces
La creación de workspaces (`/create`) y el seteo de proyecto (`--project`) implementan una estricta sanitización contra vulnerabilidades de **Path Traversal**. Los nombres de proyecto solo pueden contener caracteres alfanuméricos, guiones (`-`) y guiones bajos (`_`). El uso de separadores de ruta (`/`, `\`, `.`, `..`) es rechazado activamente.

## Arquitectura Resumida

La arquitectura desacopla estrictamente la interfaz de la lógica agnóstica:

1. **`apps/cli/` (Capa de Presentación):** 
   - Parsea argumentos y maneja la I/O de terminal.
   - Resuelve las dependencias (ej: instanciar `OpenAIAdapter`).
   - Mantiene la sesión interactiva.
2. **`core/` (Núcleo de Dominio):**
   - **AgentKernel:** La fachada principal que inicializa los eventos, resuelve dependencias y delega la ejecución al `FlowEngine`.
   - **FlowEngine:** El motor de ejecución de flujo multi-paso configurable (`FlowEngine.ts`). Orquesta de manera secuencial y determinista el ciclo de vida: Contexto -> Prompt -> LLM -> Policy Engine -> Tool Execution -> Ephemeral Context.
   - **ActionCatalog:** Catálogo centralizado y tipado que define las acciones disponibles (`send_message`, `none`, `read_file`).
   - **ContextBuilder & PromptBuilder:** Construyen el entorno conversacional histórico y las instrucciones del sistema, separando los roles de mensaje `system` y `user`.
   - **LLMAdapters:** Interfaz común para comunicarse con modelos AI (soporta `mock` y `openai`).

## Capacidades

### ✅ Implementadas
- Enrutamiento y ciclo de vida de CLI (One-off / Interactivo).
- Inyección dinámica de adaptadores de LLM (`mock`, `openai`).
- Parseo profundo de parámetros y aislamiento posicional de texto.
- Manejo limpio de errores controlados (`FrameworkError`).
- Motor de **Agente** con ejecución de flujo multi-paso real determinista (`FlowEngine`).
- Catálogo unificado de herramientas (`ActionCatalog`) y evaluación dinámica en el `PolicyEngine`.
- Soporte para herramientas reales: lectura de archivos locales (`ReadFileTool`) con validación de seguridad de rutas.
- Aislamiento estricto de historial de memoria de conversación utilizando identificadores de sesión (`sessionId`), proyecto (`projectId`) y ejecución (`runId`/`stepId`).
- Mensajería del LLM limpia y estructurada utilizando separación de roles (`system` para instrucciones y `user` para el mensaje actual).
- Suite extensa de Unit Tests (Vitest) para todos los componentes, garantizando un build reproducible (`npm test` y `npm run typecheck`).
- File System de Workspaces con validación de seguridad contra Path Traversal integrada (`ProjectDirectoryAdapter`).

### 🚧 Simuladas o Pendientes
- **Manejo de Sesiones Avanzado:** El comando interactivo `/session` muestra información descriptiva de la sesión, pero el ciclo de vida de cierre automático requiere un gestor de sesiones de red en el roadmap futuro.
