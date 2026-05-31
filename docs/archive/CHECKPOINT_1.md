# Checkpoint 1: Base del CLI y Capa LLM

**Fecha**: Mayo 2026
**Proyecto**: AgentFrameWork

Este documento sirve como punto de control y referencia arquitectónica de lo que se ha construido hasta el momento en la fase inicial del framework.

## 1. Arquitectura General y Decisiones de Diseño

El framework está siendo diseñado bajo una filosofía de **desacoplamiento estricto** y **alta testeabilidad**. 
- La interacción del usuario (CLI) está completamente separada de la lógica de negocio (Core).
- La persistencia y el sistema de archivos no deben mezclarse con las capas de presentación ni de procesamiento, manteniéndose aisladas mediante adaptadores.
- No existen dependencias de red prematuras; todas las integraciones externas (como OpenAI) se manejan a través de contratos (interfaces) y mocks locales determinísticos.

## 2. Módulos Implementados

### 2.1. Interfaz de Línea de Comandos (`apps/cli/`)
Una CLI interactiva basada en REPL que funciona como la interfaz gráfica del agente en la terminal.

- **`cli.ts`**: Entry point que levanta el proceso.
- **`CommandHandler.ts`**: Orquestador principal de la CLI. Mantiene el estado de la sesión (Contexto Global vs Contexto de Proyecto). Autocompleta comandos, maneja el historial, despacha los mensajes y delega de manera abstracta la inferencia al Kernel (actualmente un stub).
- **`Renderer.ts`**: Aísla todas las llamadas a la salida estándar (`console.log`). Se encarga de aplicar colores, formatear errores y proveer los menús de ayuda dinámicos según el contexto.
- **`ProjectDirectoryAdapter.ts`**: Adaptador local y hermético creado exclusivamente para aislar las llamadas al módulo nativo `fs` en Node.js. Permite listar, verificar y crear carpetas físicas bajo el directorio raíz `projects/`.

**Comandos soportados:**
- Globales: `/use`, `/create`, `/list`, `/help`, `/version`, `/debug`, `/exit`.
- Proyecto: `/close`, `/session`, `/help`, `/exit` (además de despachar texto normal).

### 2.2. Capa de Modelos de Lenguaje (`core/llm/`)
La abstracción central para que el framework se comunique con cualquier proveedor de IA.

- **`LLMAdapter.ts`**: Define los contratos limpios y estrictos (`LLMRole`, `LLMMessage`, `LLMGenerateInput`, `LLMGenerateResult`).
- **`MockLLMAdapter.ts`**: Un mock 100% determinístico diseñado para pruebas automatizadas. Permite configurar respuestas fijas, colas de respuestas secuenciales, simulación de errores y mantiene un historial exacto de las llamadas recibidas.
- **`OpenAIAdapter.ts`**: Un stub explícito preparado para el futuro que por ahora rechaza su ejecución para evitar accesos prematuros a red.

### 2.3. Pruebas Unitarias (`tests/`)
Se ha configurado Vitest, logrando una cobertura completa del comportamiento público observable de ambos módulos implementados, sin depender de redes ni de sistemas de archivos reales.
- `tests/cli/*`: Prueba la lógica de parsing, renderizado, y el aislamiento del disco mediante el mock del adaptador de directorios. (18/18 pruebas)
- `tests/core/llm/*`: Prueba exhaustivamente el comportamiento del mock LLM (respuestas, errores, historial) y valida los contratos exportados. (7/7 pruebas)

## 3. Estado del Disco y Carpetas Físicas
- Se acordó el uso de la carpeta `projects/` para alojar los workspaces físicos de los usuarios localmente.
- Los tests y el código fuente viven estrictamente separados.

## 4. Próximos Pasos (Hoja de Ruta)
El siguiente paso lógico y arquitectónico es implementar la capa de **Respuesta Estructurada**:
- **`core/response/`**: 
  - `ResponseSchemaFactory`: Para generar dinámicamente esquemas JSON soportados por el LLM.
  - `ResponseValidator`: Para asegurar que la salida cruda del LLM cumpla con los esquemas requeridos por el routing y los skills del agente.
