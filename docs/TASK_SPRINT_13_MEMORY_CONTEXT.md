# Sprint 13: MemoryReader y HistoryContext

## Objetivo del Sprint
Dotar al Agente de "memoria de trabajo" a corto plazo. Hasta ahora, el Agente persiste su historial en el `EventLog` pero sufre de amnesia durante la ejecución, ya que el LLM no recibe este contexto en su prompt. El objetivo es crear una capa de lectura determinista (`MemoryReader`) que extraiga y compacte los eventos recientes (`UserMessageReceived`, `ActionExecuted`, `ActionFailed`, `PolicyRejected`) en un `HistoryContext` optimizado para inyectarse en el System Prompt, sin recurrir a embeddings, bases vectoriales ni resúmenes con LLM.

## Contratos Propuestos

### `HistoryContext`
```typescript
export interface HistoryContext {
  recentUserMessages: string[];
  recentActions: Array<{
    actionType: string;
    success: boolean;
    message?: string;
    error?: string;
  }>;
  recentPolicyRejections: Array<{
    reason: string;
    actionType?: string;
    confidence?: number;
  }>;
  eventCount: number;
}
```

### `MemoryReader`
```typescript
export class MemoryReader {
  constructor(private readonly eventLog: EventLog) {}

  public read(options?: { limit?: number }): HistoryContext {
    // Default limit: 20 últimos eventos relevantes
  }
}
```

## Recomendación de Integración
**Recomendación:** *Integración inmediata pero ligera en este mismo Sprint.*
Crear el `MemoryReader` en absoluto aislamiento primero (`core/memory/`). Una vez que la suite de tests certifique que la lectura es segura y respeta los límites, integrar su salida en el `ContextBuilder` actual. El `AgentKernel` inyectará el `EventLog` al `MemoryReader`, pasará el `HistoryContext` al `ContextBuilder`, y este último lo serializará limpiamente (ej. formato Markdown) dentro del contexto para el `PromptBuilder`.

## Archivos Probables a Crear/Modificar
- **Nuevos:** `core/memory/HistoryContext.ts`, `core/memory/MemoryReader.ts`, `core/memory/index.ts`.
- **Tests:** `tests/core/memory/MemoryReader.test.ts`.
- **Modificaciones Mínimas:** `core/agent/AgentKernel.ts` (para instanciar y usar `MemoryReader`), `core/context/ContextBuilder.ts` (para aceptar el `HistoryContext` en su construcción).

## Pruebas Mínimas Requeridas
- `[ ]` `MemoryReader` clasifica correctamente `UserMessageReceived` en `recentUserMessages`.
- `[ ]` `MemoryReader` decodifica `ActionExecuted` y `ActionFailed` en `recentActions` con su status correspondiente.
- `[ ]` `MemoryReader` transfiere correctamente `PolicyRejected` a `recentPolicyRejections`.
- `[ ]` El lector respeta estrictamente el `limit` pasado por parámetro.
- `[ ]` Ignora silenciosamente eventos desconocidos o incompatibles.
- `[ ]` Opera de manera `read-only`: no muta el array de eventos subyacente.
- `[ ]` Es compatible con eventos rehidratados provenientes del `FileEventLog`.
- `[ ]` Evita incluir propiedades u objetos ajenos al contrato estricto del Payload.

## Fuera de Alcance Explícito
- No se implementará *File I/O Skill* (el Agente aún no lee el disco).
- No se implementarán Embeddings ni Bases de Datos Vectoriales.
- No se usará SQLite.
- No se enviará el historial al LLM para que lo "resuma".
- No se implementarán bucles de *Self-Correction* ni *Retries*.
- No se tocará la persistencia de Políticas desde un archivo externo.
- No se modificará el CLI.
- No se modificará `Kernel.ts` (Legacy intacto).

## Riesgos Técnicos Identificados
- **Inflación del Prompt:** Si el `limit` es alto o los mensajes/errores de las acciones son gigantes (ej. un stacktrace de 5MB), el prompt superará el Context Window del LLM.
- **Fuga de Secretos:** Si un evento guarda un secreto por error, el `MemoryReader` podría re-inyectarlo en un prompt futuro exponiéndolo a servicios de terceros (OpenAI).
- **Crecimiento Indefinido:** La falta de resúmenes (summarization) implica que, eventualmente, la limitación dura de truncamiento (`limit: 20`) se sentirá torpe, olvidando contexto fundacional lejano.
- **Correlación Semántica:** Sin *embeddings*, todos los últimos 20 eventos tienen igual peso en el prompt, aunque algunos no tengan relevancia con la intención actual del usuario.

## Siguiente Paso Recomendado
Sellar la planificación realizando el commit de este documento (`docs/TASK_SPRINT_13_MEMORY_CONTEXT.md`). Tras ello, procederemos a codificar el componente `MemoryReader` en estricto aislamiento, asegurando su correcto funcionamiento con `vitest` antes de engarzarlo en el `ContextBuilder`.
