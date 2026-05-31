# Sprint 2: Resolución de Estado en Memoria

## Objetivo del Sprint
Construir una capa mínima que derive un `State` consolidado a partir de una lista de eventos (`EventLog`). Esto dotará al sistema de contexto temporal en memoria, sin conectar todavía con el CLI, Kernel, LLM, skills o persistencia física.

## Alcance Estricto
Implementar un `StateResolver` capaz de reducir una colección de `Event<unknown>` en una interfaz de estado mínima (`State`). Se ignorarán eventos no soportados y el estado resultante operará únicamente en memoria.

## Archivos a Crear
- `core/state/State.ts`
- `core/state/StateResolver.ts`
- `core/state/index.ts` (Para exportar la interfaz y la clase)
- `tests/core/state/StateResolver.test.ts`

## Archivos que NO se deben tocar
- `core/kernel/Kernel.ts`
- `apps/cli/CommandHandler.ts`
- `apps/cli/cli.ts`
- Adaptadores en `core/llm/*`
- Componentes de routing, skills o policies.

## Contratos Propuestos

### `State`
```typescript
export interface State {
  lastUserMessage?: string;
  projectId?: string;
  sessionId?: string;
  messageCount: number;
  lastEventId?: string;
  updatedAt?: Date;
}
```

### `StateResolver`
```typescript
import { Event, EventType, UserMessageReceivedPayload } from '../events';
import { State } from './State';

export class StateResolver {
  public resolve(events: Event<unknown>[]): State {
    // Reducer implementation
  }
}
```

## Validación Mínima y Comportamiento Esperado
- **Reducción Inmutable:** El `StateResolver` no debe mutar los eventos de entrada.
- **Tolerancia a Desconocidos:** Debe ignorar amablemente cualquier evento cuyo `type` no esté explícitamente mapeado (ej. diferente a `UserMessageReceived`), sin arrojar errores.

## Tests Mínimos (`tests/core/state/StateResolver.test.ts`)
- `[ ]` Estado inicial vacío con `messageCount: 0`.
- `[ ]` Resolver un solo `UserMessageReceived` mapeando correctamente `lastUserMessage`, `projectId` y `sessionId`.
- `[ ]` Resolver múltiples mensajes y conservar únicamente el último mensaje en `lastUserMessage`, sumando a `messageCount`.
- `[ ]` Preservar `projectId` y `sessionId` del último evento aplicable.
- `[ ]` Actualizar `lastEventId` usando el id del último evento del log.
- `[ ]` Actualizar `updatedAt` desde el timestamp del último evento procesado.
- `[ ]` Garantizar que no se mutan los eventos originales.
- `[ ]` Manejar un log vacío.
- `[ ]` Ignorar eventos con `type` desconocido de forma segura.

## Fuera de Alcance Explícito
- No modificar el flujo interactivo (CLI).
- No modificar el orquestador legado (`Kernel.ts`).
- No crear todavía el `AgentKernel`.
- No persistir en disco (base de datos o sistema de archivos).
- No implementar `Skills`, `Routing`, o llamadas a LLM (`LLMAdapter`).
- No agregar dependencias de terceros (como librerías de reducción).
- No alterar los archivos de store ya existentes (`ProjectStore.ts`, etc.).

## Riesgos Técnicos
- **Definición Prematura de State:** La interfaz `State` propuesta es mínima y rígida. A medida que los casos de uso crezcan, este esquema podría requerir refactorizaciones para alojar propiedades dinámicas o metadatos (`facts`).
- **Crecimiento Futuro de Eventos:** El switch case o la reducción en `StateResolver` podría volverse un cuello de botella u objeto gigante a medida que el `EventType` se expanda. Podría requerirse un patrón *Visitor* o *Dispatcher* en sprints futuros.
- **Semántica de Project/Session:** `projectId` y `sessionId` asumen un mapeo 1:1, pero la ausencia de identificadores robustos podría mezclar contextos en el futuro si el log es global.
- **Manejo de Eventos Desconocidos:** Ignorar silenciosamente puede esconder bugs si se registra un evento nuevo y se olvida mapear en el resolver.
- **Mutabilidad de Payloads:** Si el estado copia referencias de objetos de payload anidados y luego esos son mutados, se podría corromper el historial.

## Criterios de Aceptación
- 100% de los tests mínimos propuestos pasan.
- El contrato de entrada es una matriz de eventos (interfaz compartida del Sprint 1) y el contrato de salida es el objeto de estado estricto.

## Siguiente Paso Recomendado
Realizar commit de este documento para versionarlo e iniciar la fase de ejecución para programar `core/state/State.ts`, `StateResolver.ts` y las pruebas `StateResolver.test.ts`.
