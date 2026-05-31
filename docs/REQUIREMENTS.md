# Especificación de Requerimientos - AgentFrameWork

Este documento consolida los requerimientos funcionales y no funcionales que rigen el diseño y la evolución de **AgentFrameWork**.

---

## 1. Requerimientos Funcionales

### RF-01: Interfaz de Consola Dual (CLI)
- El sistema debe funcionar en **Modo One-off** (ejecución única de mensaje y salida inmediata) y en **Modo Interactivo (REPL)** (bucle de lectura, evaluación e impresión continuo).

### RF-02: Gestión de Contextos de Proyectos (Workspaces)
- El sistema debe permitir aislar y alternar directorios de trabajo denominados "workspaces" o "proyectos".
- El usuario puede listar, crear y entrar en un workspace mediante comandos interactivos (`/list`, `/create <name>`, `/use <name>`).
- Las acciones de herramientas y la persistencia de sesión deben estar estrictamente confinadas al workspace activo.

### RF-03: Gestión de Sesiones Persistentes
- El sistema debe soportar sesiones nombradas de interacción.
- Se debe almacenar el historial completo de eventos del flujo en un archivo JSON estructurado bajo `projects/<projectId>/sessions/<sessionId>.json`.
- Debe existir compatibilidad para migrar automáticamente registros de sesión antiguos (`events.json`) al formato de sesión predeterminado (`default.json`).

### RF-04: Inyección Dinámica de Proveedores LLM
- Se debe soportar el intercambio transparente de modelos de lenguaje en tiempo de ejecución.
- De forma predeterminada, se debe usar un proveedor `mock` local sin costo ni red.
- Opcionalmente, se debe poder cambiar a `openai` validando credenciales mediante variable de entorno (`OPENAI_API_KEY`) o banderas paramétricas.

### RF-05: Motor de Ejecución Multi-Paso (`FlowEngine`)
- El motor agéntico debe permitir realizar razonamiento iterativo ejecutando múltiples pasos de herramientas/skills antes de dar una respuesta final.
- El ciclo de vida de la ejecución de cada paso debe estar delimitado por configuración (`FlowConfig.maxSteps`, `FlowConfig.maxToolCalls`).
- El flujo debe interrumpirse inmediatamente si ocurre un rechazo de políticas, fallo en herramientas, o se completa la acción final (`send_message`).

### RF-06: Catálogo de Acciones y Plugins
- El sistema debe estructurar las capacidades del agente en un catálogo modular (`ActionCatalog`).
- Se debe permitir la carga dinámica de herramientas externas (`PluginLoader`) compiladas desde la carpeta `plugins/tools/` basándose en el manifiesto `agent.config.json` de cada workspace.

### RF-07: Memoria de Trabajo y Auditoría
- El agente debe contar con una memoria de trabajo a corto plazo (`WorkingMemoryStore`) para retener de forma efímera los resultados de herramientas de pasos anteriores y usarlos en la toma de decisiones inmediata.
- Todos los pasos ejecutados deben guardarse de forma compacta (sanitizada) en un historial de ejecución de trazas (`ExecutionTrace`).

---

## 2. Requerimientos No Funcionales

### RNF-01: Seguridad ante Path Traversal
- Queda estrictamente prohibida la manipulación o creación de directorios fuera de los límites autorizados.
- Los nombres de proyectos/workspaces deben sanitizarse rígidamente bajo una whitelist alfanumérica (`^[a-zA-Z0-9_-]+$`).
- La lectura y escritura de archivos locales mediante herramientas del agente debe rechazar rutas absolutas o de retroceso (`..`).

### RNF-02: Desacoplamiento de Componentes
- El núcleo (`core/`) debe ser completamente independiente de la interfaz de consola (`apps/cli/`). Ninguna lógica de renderizado de terminal ni manipulación de stdout/stderr de UI debe infiltrarse en el Core.

### RNF-03: Rendimiento y Eficiencia de Tokens
- El sistema debe sanitizar los payloads masivos resultantes de herramientas en el `EventLog` persistente y en el `ExecutionTrace` para evitar sobrecargar la memoria de almacenamiento.
- Los resultados de lecturas de herramientas se tratarán de forma efímera y no se persistirán de manera indefinida en el historial del prompt de largo plazo.

### RNF-04: Robustez ante Alucinaciones del Formato JSON
- El parser de decisiones (`DecisionParser`) debe ser tolerante a errores sintácticos comunes de los LLM (como envolturas de bloques markdown ` ```json ` o intenciones semánticas variadas) y autocorregir/normalizar los datos de entrada para que concuerden estrictamente con el tipo `Decision` esperado.

### RNF-05: Cobertura de Pruebas
- Toda nueva característica o corrección crítica debe estar respaldada por pruebas de integración y unitarias de ejecución rápida y confiable usando la suite de Vitest.
