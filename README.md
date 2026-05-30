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
- **Correr Tests:**
  ```bash
  npx vitest run
  ```

## Uso del CLI

El framework proporciona una interfaz de línea de comandos rica que opera en dos modos: "One-off" e "Interactivo".

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
| `--api-key <key>` | Clave de acceso para la API de OpenAI. | N/A |
| `--project <id>` | ID del proyecto/workspace a usar en el contexto. | N/A |
| `--session <id>` | ID de la sesión a utilizar. | N/A |
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
| `/create <name>` | Crea un nuevo workspace. | Simulado |
| `/use <name>` | Entra al contexto de un workspace. | Simulado |
| `/close` | Sale del contexto del workspace actual. | Implementado |
| `/session` | Muestra información de la sesión actual. | Simulado |
| `/exit` | Cierra el CLI. | Implementado |

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
- Manejo limpio de errores capturados con el componente `Renderer`.
- Suite extensa de Unit Tests (Vitest).

### 🚧 Simuladas o Pendientes
- **Persistencia de Workspaces:** Las operaciones `/create`, `/list`, `/use` se mantienen puramente en memoria, simulando el File System.
- **Manejo de Sesiones:** El comando `/session` notifica que la persistencia de sesión aún no está operativa.
- **Módulos Agénticos Avanzados:** La estructura base para `flow`, `memory`, `routing`, `skills`, `tools` existe en `core/`, pero actualmente los directorios se mantienen como placeholders para el roadmap futuro.
- **Configuración mediante Entorno (`.env`):** Aún no se extrae la clave del API automáticamente de `process.env`.
