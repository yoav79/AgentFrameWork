# Memoria Técnica - AgentFrameWork

## 1. Propósito Técnico del Sistema
AgentFrameWork es una infraestructura diseñada en TypeScript/Node.js orientada a simplificar y estandarizar la creación de aplicaciones basadas en Agentes LLM. Proporciona una interfaz de orquestación CLI altamente desacoplada de la lógica de negocio central, utilizando un modelo de Puertos y Adaptadores que facilita el intercambio transparente de motores de lenguaje (ej: cambiando un mock virtual por OpenAI).

## 2. Arquitectura Observada
El sistema se encuentra lógicamente dividido en dos superestructuras principales:

### `apps/cli/` (Capa de Orquestación y Presentación)
Actúa como punto de entrada y consumidor del framework. Sus responsabilidades son estrictamente perimetrales:
- **`cli.ts`:** El entrypoint físico que orquesta la inicialización.
- **`AdapterFactory.ts`:** Se encarga de la Inyección de Dependencias decodificando las intenciones del usuario (flags `--llm`, `--api-key`) e instanciando el LLM.
- **`CommandHandler.ts`:** Actúa como Enrutador. Aísla comandos interactivos (`/use`, `/exit`) de mensajes puros (One-off) para construir variables de ejecución.
- **`Renderer.ts`:** Encargado de transformar estructuras lógicas en experiencias visuales (terminal).

### `core/` (Capa de Dominio y Lógica Agnóstica)
Donde reside la inteligencia inmutable de la plataforma:
- **`kernel/` (`Kernel.ts`):** El corazón. Recibe el adaptador y lo interconecta con los contextos de ejecución. Recibe una orden, despacha la generación, e invoca a los formateadores.
- **`context/` (`ContextFactory.ts`):** Entidades de dominio. Envuelve datos crudos de la CLI (`sessionId`, `projectId`) en un `ExecutionContext` seguro y validado.
- **`llm/` (`MockLLMAdapter`, `OpenAIAdapter`):** Proveedores concretos y firmas que encapsulan las llamadas REST (o simulaciones) detrás de la interfaz común `LLMAdapter`.
- **`response/`:** Subsistema crítico de normalización. Asegura que independientemente de la respuesta cruda de un LLM o de un fallo de red, se devuelva un objeto determinista tipificado (mensaje o error).
- **`errors/` (`FrameworkError.ts`):** Interfaz para lanzar errores contextuales propios en toda la app.

## 3. Flujo de Ejecución del CLI
El ciclo de vida general del "mensaje" opera de la siguiente manera:
1. `cli.ts` recupera `process.argv`.
2. `AdapterFactory` mapea argumentos en clases (`LLMAdapter`).
3. `Kernel` es inicializado con el adaptador.
4. `CommandHandler` evalúa argumentos posicionales restantes. Crea el contexto vía `ContextFactory` (ej. si pasaron `--project`, se ata al contexto).
5. `Kernel.run(context)` invoca `LLMAdapter.generate()`.
6. El resultado (o su excepción atrapada) baja hacia `ResponseNormalizer.normalize()`.
7. `CommandHandler` recibe el objeto formateado y ordena al `Renderer` pintarlo en `stdout` o `stderr`.

## 4. Capacidades Actuales de la Infraestructura
- Inversión de Control funcional completa; la capa de ruteo está implementada y es extensible.
- Protección a fallos en cadena gracias al `ResponseNormalizer` el cual envuelve respuestas rotas o red fallida en esquemas legibles en lugar de *panics*.
- Aislamiento robusto de Tests Unitarios (100% pasando usando la librería `vitest`).

## 5. Capacidades Simuladas y Roadmap a Futuro
Actualmente, el sistema simula varias capacidades que deberán concretarse en iteraciones posteriores:

* **File System y Workspaces:** Las acciones `/create` y `/list` operan en memoria.
* **Sesiones Estables:** El comando `/session` solo emite un mensaje, sin estado persistido entre recargas.

### Módulos Reservados (Placeholders)
En el directorio `core/` conviven carpetas base para una agresiva evolución futura:
- `a2a/`: Reservado para comunicación Agent-to-Agent.
- `flow/`: Para grafos de ejecución y pipelines asíncronos paralelos.
- `memory/`: Para vectores o RAG.
- `routing/`: Para dispatchers de intent a habilidades concretas.
- `skills/` & `tools/`: Extensibilidad dinámica de capacidades.
- `state/`: Para persistencia granular.

## 6. Reglas Fundamentales para Futuros Cambios
1. **Inmutabilidad del Core:** Funciones relativas a interacción del usuario, parseo de strings de terminal o renderizado JAMÁS deben sangrar dentro de `core/`.
2. **Dependencias Estrictas:** `core/llm/LLMAdapter.ts` nunca debe importar lógica de `apps/cli/`.
3. **Manejo de Errores Categórico:** Para cualquier error predecible en las capas nuevas, arrojar siempre instancias de `FrameworkError` permitiendo al framework atraparlos con seguridad en los bordes.

## 7. Riesgos Técnicos Observados
- La configuración a través de flags está provocando sobre-exposición de credenciales de API. Requiere urgentemente la introducción de un analizador `.env`.
- Falta la sincronización de la documentación interna estática (como los comandos mostrados por `Renderer.help`) en consonancia con las actualizaciones del parseador de CLI.
