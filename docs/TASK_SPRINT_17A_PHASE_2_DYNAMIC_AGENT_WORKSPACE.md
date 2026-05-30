# Planificación Sprint 17A Fase 2: Reconstrucción Dinámica de AgentKernel

## 1. Objetivo
- Permitir que los comandos interactivos que cambian de contexto (como `/use <workspace>` y `/close`) reconstruyan el `AgentKernel` al vuelo.
- Asegurar que al arrancar con `--persist` y luego cambiar de workspace con `/use demo`, los eventos se escriban fielmente en `projects/demo/events.json`.
- Garantizar la segregación total de memoria e historial entre workspaces.
- Mantener la robustez del modo sin persistencia (efímero) y los comandos *one-off*.

## 2. Diagnóstico Actual
- **Creación Actual:** `AgentKernel` se instancia exactamente una sola vez durante el `bootstrap` en `cli.ts` mediante `AgentFactory.create(llmAdapter, { persist, projectId })`.
- **Inyección Fija:** Esta única instancia se inyecta por constructor al `CommandHandler`. 
- **Desconexión del EventLog:** Cuando el usuario lanza `/use demo`, el `CommandHandler` actualiza internamente `parsedArgs.projectId = 'demo'` y se lo inyecta en el *input* (`AgentRunInput`) a `AgentKernel.run()`. Sin embargo, el `EventLog` y la `MemoryReader` residentes dentro de ese `AgentKernel` ya nacieron atados al `projectId` original (o al global). Por tanto, **el log de eventos no cambia físicamente** y el agente sigue escribiendo en el log incorrecto.

## 3. Arquitectura Recomendada
- **Reemplazo por Factory:** Modificar la inyección de dependencias del `CommandHandler`. En lugar de (o además de) recibir una instancia fija, debe recibir un callback o factoría:
  ```typescript
  type AgentKernelFactory = (projectId?: string) => AgentKernel;
  ```
- **Fábrica en `cli.ts`:** En `cli.ts`, definiremos este closure, capturando las opciones de LLM y `--persist`:
  ```typescript
  const createAgent = (id?: string) => AgentFactory.create(llmAdapter, {
    persist: isPersistMode,
    projectId: id
  });
  ```
- **Reconstrucción Dinámica:** `CommandHandler` inicializa `this.agentKernel = createAgent(parsedArgs.projectId)`.
  - Al procesar `/use demo` (y ser validado exitosamente), el handler invoca `this.agentKernel = createAgent('demo')`.
  - Al procesar `/create demo`, se hace exactamente lo mismo tras crearlo en disco.
  - Al procesar `/close`, se invoca `this.agentKernel = createAgent()` (sin id, volviendo al contexto global).

## 4. Comportamiento Esperado
- **Sin `--persist` (efímero):** Arranca con memoria en proceso. Si hace `/use demo`, se crea un *nuevo* `AgentKernel` con nueva memoria efímera, logrando aislar la conversación anterior (evitando contaminación entre proyectos).
- **Con `--persist --project demo`:** Usa `projects/demo/events.json` como hoy.
- **Con `--persist` (global) seguido de `/use demo`:** Inicia apuntando a `global/events.json`. Al cambiar, se destruye el Kernel actual y nace uno nuevo conectado a `projects/demo/events.json`. Todos los mensajes futuros van al lugar correcto.
- **Fallo de Validación:** Si `/use ../evil` es rechazado, la reconstrucción jamás ocurre, conservando el `AgentKernel` actual intacto.

## 5. Tests Propuestos
- **Pruebas de Unitarias (`CommandHandler.test.ts`):** 
  - Mockear el closure `createAgent`.
  - Afirmar que `/use demo` llama a `createAgent('demo')` y que los envíos subsiguientes usan la nueva instancia de Kernel devuelta.
  - Afirmar que `/close` llama a `createAgent()` sin argumentos.
  - Afirmar que `/use ../evil` falla (como ya lo hace en Fase 1) y **no** llama a `createAgent`.
- **Pruebas de Integración (E2E):**
  - Arrancar con `--persist`, simular un `/use demo`, enviar un mensaje, y confirmar (leyendo el fs) que se creó/escribió en `projects/demo/events.json`.

## 6. Fuera de Alcance
- No implementar `ReadFileTool` ni un ToolRegistry genérico.
- No agregar lectura/escritura de File I/O (más allá de los eventos existentes).
- No realizar cambios en `PolicyEngine`.
- No modificar internamente el comportamiento de `MemoryReader`.
- No implementar *self-correction* ni reintentos.

## 7. Riesgos Técnicos
- **Pérdida de historial en caliente:** La reconstrucción dinámica resetea efectivamente el `InMemoryEventLog`. Esto es arquitectónicamente *correcto* (cada workspace es un silo), pero los usuarios que esperen que la IA "recuerde" lo hablado justo antes de hacer `/use` se toparán con amnesia. 
- **Refactorización de Mocks en Tests:** Todos los tests en `CommandHandler.test.ts` asumían la inyección directa de `AgentKernel`. Refactorizar el constructor para requerir una fábrica romperá la firma actual en la suite de pruebas, requiriendo una actualización casi total de ese archivo de tests.
- **Gestión de Recursos:** Si el adaptador LLM o el `AgentKernel` alguna vez gestionan recursos persistentes (como sockets o file descriptors abiertos permanentemente), desecharlos mediante reasignación (`this.agentKernel = createAgent()`) podría causar fugas de memoria (memory leaks). Actualmente, la arquitectura es limpia y recolectable por el Garbage Collector, por lo que el riesgo es nulo hoy, pero debe tenerse en cuenta para el futuro.
