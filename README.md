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

El framework proporciona una interfaz de línea de comandos rica que opera en dos modos: "One-off" e "Interactivo", y soporta tanto el modo de kernel nativo (Legacy) como el nuevo motor agéntico (`--agent`).

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
Para invocar al nuevo `AgentKernel` que provee memoria contextual histórica e integración con el `EventLogFactory`, usa la bandera `--agent`. Si deseas persistir los eventos entre ejecuciones (en el disco local dentro de `~/.agentframework` o en la carpeta `projects/`), añade `--persist`.
```bash
npx tsx apps/cli/cli.ts --agent --persist
```
*Nota: La bandera `--persist` se ignora de forma segura si no se habilita `--agent`.*

### Selección de Proveedor LLM

Por defecto, el CLI usa un proveedor `mock` seguro que no consume recursos de red. Puedes cambiar dinámicamente a `openai` usando banderas.

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
| `--agent` | Habilita el `AgentKernel` con soporte de memoria histórica y eventos. | `false` |
| `--persist` | Habilita la persistencia de memoria en el sistema de archivos (solo con `--agent`). | `false` |
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
   - **Kernel:** El motor central (`Kernel.ts`) que orquesta el flujo de ejecución.
   - **ContextFactory:** Entidad que unifica la entrada y metadatos.
   - **LLMAdapters:** Interfaz común para comunicarse con modelos AI.
   - **ResponseNormalizer:** Tipifica y homogeniza respuestas (texto o error).

## Capacidades

### ✅ Implementadas
- Enrutamiento y ciclo de vida de CLI (One-off / Interactivo).
- Inyección dinámica de adaptadores de LLM (`mock`, `openai`).
- Parseo profundo de parámetros y aislamiento posicional de texto.
- Manejo limpio de errores controlados (`FrameworkError` con validación estricta de códigos como `VALIDATION_ERROR`, `CONFIG_ERROR`).
- Soporte temprano del nuevo **Agente** (`AgentKernel`) con integración a `MemoryReader` y `EventLogFactory` para contexto histórico.
- Suite extensa de Unit Tests (Vitest) para todos los componentes, garantizando un build reproducible (`npm test` y `npm run typecheck`).
- File System de Workspaces con validación de seguridad contra Path Traversal integrada (`ProjectDirectoryAdapter`).

### 🚧 Simuladas o Pendientes
- **Manejo de Sesiones:** El comando `/session` notifica que la persistencia puramente de sesión interactiva aún no está operativa en modo legacy.
- **Módulos Agénticos Avanzados:** La estructura base para `flow`, `routing`, `skills`, `tools` existe en `core/`, pero aguarda implementaciones concretas de herramientas de lectura de disco o auto-corrección (roadmap futuro).
