# Sprint 14: Prompt Memory Integration

## Objetivo del Sprint
Completar la conexión del `MemoryReader` construido en el Sprint 13 con el sistema de inferencia agéntica. El objetivo es que el `AgentKernel` logre leer el historial de eventos en tiempo de ejecución y lo pase al `ContextBuilder` y al `PromptBuilder` para que el LLM reciba una sección consolidada de "memoria a corto plazo". Esta sección informará a la IA sobre qué acciones ejecutó recientemente, cuáles fallaron, y qué dictámenes emitió el `PolicyEngine` en su contra, permitiendo contexto iterativo sin colapsar la arquitectura legacy.

## Opciones Arquitectónicas Evaluadas

- **Opción A:** Inyectar el `MemoryReader` directamente en el constructor de `AgentKernel`. (Riesgo: el constructor de `AgentKernel` sigue creciendo).
- **Opción B:** Añadir el `MemoryReader` como dependencia **opcional** en el constructor de `AgentKernel`.
- **Opción C:** Crear un objeto aglutinador (ej. `AgentDependencies`) para limpiar el constructor del Kernel. (Riesgo: requiere refactor masivo de tests existentes).
- **Opción D:** Integrar el historial únicamente en `ContextBuilder` y `PromptBuilder`, dejando el cableado en `AgentKernel` para el Sprint 15. (Riesgo: no entrega valor end-to-end).

### Opción Recomendada (MVP)
**Recomiendo encarecidamente la Opción B.**
Al hacer el parámetro opcional (`private readonly memoryReader?: MemoryReader`), evitamos romper decenas de tests legacy y simplificamos el refactor. En el método `.run()`, el Kernel simplemente hará un check (`if (this.memoryReader)`) para recuperar el `HistoryContext` y pasarlo al `ContextBuilder`. La responsabilidad de inyectar el lector recaerá limpiamente en la `AgentFactory`.

## Cambios Probables
- `core/context/ContextBuilder.ts`: Actualizar la firma `build(state: State, history?: HistoryContext)` para añadir el bloque histórico al `BuiltContext`.
- `core/context/PromptBuilder.ts`: Identificar si existe el bloque histórico y renderizar dinámicamente la sección `Recent Memory`.
- `core/agent/AgentKernel.ts`: Recibir opcionalmente el `MemoryReader` e invocar `.read()` en cada pasada.
- `core/agent/AgentFactory.ts`: Instanciar `new MemoryReader(eventLog)` y pasarlo al `AgentKernel`.
- Actualización sistemática de la suite de tests para asegurar que el prompt cambie al inyectar historial.

## Formato de Memoria en el Prompt
La estructura generada por el `PromptBuilder` debe ser extremadamente concisa y defensiva:

```text
Recent Memory:
- [User] Message: "create a file"
- [System] Action Executed (send_message): Success
- [System] Action Failed (read_file): Permission denied
- [System] Policy Rejected: Action "format_disk" blocked (unknown action)
```
**Reglas de Oro:**
- NUNCA incluir prompts completos previos.
- NUNCA incluir *API Keys* ni secretos de configuración.
- Limitar longitud por campo (ya mitigado por el truncamiento en `MemoryReader`).

## Comportamiento Esperado
- El AgentKernel fluirá armónicamente. Si `memoryReader` está presente, nutrirá al prompt. Si no (o en flujos legacy o tests antiguos), el sistema funcionará ciego como lo hacía hasta el Sprint 12.
- El binomio CLI `--agent --persist` se volverá inmensamente poderoso, acumulando historial entre ejecuciones.
- Si por alguna razón la lectura de memoria arroja error, el `AgentKernel` debe estar preparado para tolerarlo y degradarse elegantemente sin colapsar el runtime.

## Pruebas Mínimas Requeridas
- `[ ]` `ContextBuilder.test.ts`: Acepta el `HistoryContext` nulo y el completo.
- `[ ]` `PromptBuilder.test.ts`: Verifica que el string final contiene la cabecera `Recent Memory` y detalla las acciones si hay historial.
- `[ ]` `PromptBuilder.test.ts`: Si no hay memoria, el prompt se genera idéntico al comportamiento previo (sin la cabecera).
- `[ ]` `AgentKernel.test.ts`: Si se inyecta un mock del `MemoryReader`, el método `read()` es invocado durante `.run()`.
- `[ ]` `AgentFactory.test.ts`: Comprueba que se instancia el lector.

## Fuera de Alcance Explícito
- No se implementarán Embeddings ni Búsqueda Vectorial Semántica.
- No se llamará al LLM para que "sintetice" o "resuma" el log.
- No se creará la *Skill* `ReadFileSkill` (no leeremos el File System).
- No se desarrollará un sistema de *Self-Correction* o *Auto-Retry*.
- No se tocará `Kernel.ts` (flujo Legacy).
- No se tocará el CLI.

## Riesgos Técnicos Identificados
- **Inflación del Prompt:** Aunque trucamos a 500 caracteres, un historial con 20 eventos complejos podría agotar los límites estrictos de tokens en modelos pequeños o elevar drásticamente los costos operativos.
- **Fuga de Secretos:** Si una *Skill* guarda un *Bearer Token* en su mensaje de error (`ActionFailed`), el prompt se lo revelará al modelo, abriendo un vector de filtración si el proveedor externo de LLM registra las inferencias.
- **Inflación del Constructor:** Añadir otra dependencia al `AgentKernel` es una deuda técnica flagrante. Tarde o temprano necesitaremos abstraer esto a un objeto contenedor (`AgentDependencies`).

## Siguiente Paso Recomendado
Realizar el commit de esta planificación estratégica (`docs/TASK_SPRINT_14_PROMPT_MEMORY_INTEGRATION.md`). Tras confirmar el blindaje del scope, iniciaremos la modificación controlada de `ContextBuilder` y `PromptBuilder`.
