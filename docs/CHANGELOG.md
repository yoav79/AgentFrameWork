# Archivo Maestro de Cambios (Changelog) - AgentFrameWork

Este archivo registra de manera sistemática los cambios, hitos de versión, refactorizaciones y correcciones en la base de código de **AgentFrameWork**.

---

## [1.0.0] - 2026-05-31
### Añadido
- **Gestión de Sesiones**: Implementación completa de los comandos `/session` (`list`, `active`, `create`, `use`, `delete`) en `CommandHandler.ts`. Las sesiones se persisten localmente en `projects/<projectId>/sessions/<sessionId>.json`.
- **UI en Consola**: Colores quirúrgicos ANSI en el modo interactivo del CLI. Las respuestas del agente se muestran en verde (`\x1b[32m`), la depuración/trazas en gris claro (`\x1b[90m`), y los inputs del usuario en negro/gris oscuro.
- **Plugins de Herramientas Dinámicas**: Creación de herramientas como complementos dinámicos en `plugins/tools/`:
  - `ReadFileTool`: Lectura segura de archivos con prevención de path traversal.
  - `WriteFileTool`: Escritura segura de archivos en el workspace.
  - `ListFilesTool`: Listar archivos del workspace.
  - `SearchUrlTool`: Herramienta de búsqueda en web mediante scrapping estático de URLs.
- **Carga Dinámica de Plugins (`PluginLoader`)**: Sistema modular que compila mediante esbuild y carga herramientas en tiempo de ejecución basándose en la configuración `agent.config.json` de cada proyecto.
- **Motor de Flujo Multi-Paso (`FlowEngine`)**: Bucle iterativo de ejecución controlado en el kernel para encadenar múltiples herramientas antes de devolver una respuesta terminal (`send_message`).
- **Almacén de Memoria de Trabajo (`WorkingMemoryStore`)**: Permite guardar temporalmente resultados de herramientas para su reinyección en prompts subsiguientes.

### Modificado
- **Robustez en `DecisionParser.ts`**:
  - Se añadió normalización inteligente para mapear intenciones comunes generadas por el LLM (`none`, `greet`, `greeting`, `social`, `conversation`, `respond | unknown`) hacia la intención válida `"respond"`.
  - Normalización ante payloads de acción vacíos o ausentes, mapeándolos por defecto a `{ type: "none", payload: {} }` en lugar de causar errores de validación críticos.
- **Estabilización de Prompting (`PromptBuilder.ts`)**:
  - Se modificó la plantilla de JSON esperado para utilizar `"type": "none"` como valor por defecto concreto en lugar de la sintaxis con barras verticales (`send_message | none | read_file`), eliminando fallos de parseo sintáctico en el LLM.
  - Se aislaron las instrucciones de tipo en la sección `Field Instructions`.

### Corregido
- **Loop de validación en saludos**: Corrección del error crítico `Decision must have a valid intent ("respond" or "unknown")` que ocurría al enviar mensajes de saludo como "hola", debido a que el LLM generaba la intención `"none"` o de tipo de acción vacía.

---

## [0.9.0] - 2026-05-30
### Añadido
- **Integración de Adaptador Real de OpenAI**: Implementación de `OpenAIAdapter` utilizando la API de Respuestas oficial de OpenAI (`client.responses.create`).
- **Sanitización de Workspaces**: Protección rígida contra inyecciones de ruta (**Path Traversal**). Los nombres de proyecto válidos quedan restringidos a la regex `/^[a-zA-Z0-9_-]+$/`.
- **Mecanismo de Falla Rápida (Fail-Fast)**: Lanzamiento estructurado de códigos de error propios (`FrameworkError`) para caídas de configuración (`CONFIG_ERROR`) e inconsistencias sintácticas (`VALIDATION_ERROR`).

---

## [0.8.0] - 2026-05-28
### Añadido
- **Estructura Modular Inicial**: Separación de las capas de CLI (`apps/cli/`) y lógica de negocio del Core (`core/`).
- **Inversión de Control**: Adaptadores de LLM encapsulados tras el contrato `LLMAdapter` (`MockLLMAdapter` para testing y desarrollo local offline).
- **Event Log Local**: Archivo de persistencia de eventos históricos de sesión (`FileEventLog`).
