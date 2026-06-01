# Plan de Trabajo y Roadmap de Próximas Ideas - AgentFrameWork

Este documento define la dirección de desarrollo a mediano y largo plazo para **AgentFrameWork**, organizándose en fases de implementación y próximas ideas funcionales.

---

## ✅ Hito G: Loop Profesional (Completado)
Se ha estabilizado el bucle de ejecución central (`FlowEngine`) añadiendo mecanismos de control robustos ("guards") para entornos profesionales, sin alterar el comportamiento determinista por defecto.
- **Capacidades Implementadas:**
  - `RepetitionDetector`: Previene bucles infinitos detectando acciones idénticas.
  - `FailureTracker`: Limita el número de fallos consecutivos antes de abortar.
  - `TerminalGuard`: Provee una acción de fallback si el agente agota los pasos sin una respuesta terminal.
  - Extensión de configuración en `FlowConfig` y pruebas combinadas exhaustivas.
- **Nota:** Los defaults se mantienen conservadores y retrocompatibles. Aspectos como `actionBudget`, `tokenBudget` y *no-progress detection* quedan pendientes. Redis, RAG, Web, MCP y arquitecturas Multi-Agent quedan fuera de este hito y se abordarán en sus respectivas fases.

---

## Fase 3: Ejecución Basada en Planes y Gestión de Artefactos (Próximo Sprint)
El objetivo es permitir que el agente aborde de manera determinista tareas extensas y complejas minimizando loops de re-ejecución.

- **Persistencia de Planes (`plan.md`)**:
  - Incorporar la creación guiada de un archivo `plan.md` en el espacio de trabajo cuando se detecte una solicitud compleja de ingeniería.
  - Implementar el ciclo **Plan-Act-Review** para que el agente actualice el estado de las tareas de forma incremental.
- **Visualización en CLI**:
  - Renderizar visualmente el avance del plan de trabajo en la terminal (ej: barra de progreso, checklists).
- **Modo Interrupción (Human-in-the-Loop)**:
  - Posibilidad de pausar la ejecución en el CLI, permitiendo al desarrollador editar a mano `plan.md` o interceptar y redirigir el enfoque del agente.

---

## Fase 4: Comunicación Agente a Agente (A2A)
Estructuración de redes de agentes especializados que colaboran para resolver un problema.

- **Diseño del Protocolo A2A**:
  - Crear un formato estandarizado de intercambio de mensajes entre agentes independientes (`AgentMessage`).
- **Orquestador Central y Sub-agentes**:
  - Implementar el rol de Agente Coordinador (Supervisor) y Agentes Especializados (ej: Agente de Código, Agente de Tests, Agente de Documentación).
- **Asignación de Sub-workspaces**:
  - Proveer espacios de archivos segmentados para sub-agentes con el fin de evitar colisiones concurrentes de escritura.

---

## Fase 5: Memoria Avanzada y RAG
Evolución de la capa de almacenamiento de memoria de contexto para proyectos a gran escala.

- **Integración de Base de Datos Vectorial**:
  - Configurar un motor ligero de embeddings (ej. local o API) para guardar trozos de archivos de código fuente y recuperarlos semánticamente.
- **Indexación Automática de Repositorios**:
  - Generar un índice semántico del workspace en segundo plano para que el agente entienda las dependencias de código rápidamente.
- **Sumarización Inteligente**:
  - Cuando el historial del archivo de sesión (`sessionId.json`) supere el límite saludable del contexto del LLM, disparar un proceso automático para condensar/resumir conversaciones previas y archivar el histórico detallado.

---

## Mejoras Funcionales Secundarias
- **Gestión Avanzada de Sesiones en REPL**:
  - Agregar comandos de eliminación explícitos para sesiones antiguas, por ejemplo `/session delete <name>` y comandos de limpieza masiva.
  - Autocompletado inteligente (Tab) en el REPL de comandos como `/use` o `/session`.
- **Integración con MCP (Model Context Protocol)**:
  - Habilitar conectores para que el framework pueda consumir y ofrecer herramientas compatibles con el estándar de MCP desarrollado por Anthropic.
