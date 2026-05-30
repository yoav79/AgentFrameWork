# Sprint 1: Event Sourcing Básico

## Objetivo del Sprint
Establecer los contratos fundacionales de la arquitectura dirigida por eventos (Event-Driven) mediante la creación de la capa base de Eventos y un Registro de Eventos en memoria (`InMemoryEventLog`). Todo operará de forma aislada, sin perturbar el flujo actual conversacional ni conectarse a LLMs.

## Alcance Estricto
Implementar **exclusivamente** las interfaces y enums del dominio de eventos en `core/events/`, una clase concreta `InMemoryEventLog`, y su respectiva suite de pruebas unitarias. 

## Archivos a Crear
- `core/events/Event.ts`
- `core/events/EventType.ts`
- `core/events/EventSource.ts`
- `core/events/EventLog.ts`
- `core/events/InMemoryEventLog.ts`
- `tests/core/events/InMemoryEventLog.test.ts`
- `core/events/index.ts` (Opcional, para exportar)

## Archivos que NO se deben tocar
- `core/kernel/Kernel.ts`
- `apps/cli/CommandHandler.ts`
- `apps/cli/cli.ts`
- Ningún `LLMAdapter`

## Contratos Propuestos

### `EventSource`
```typescript
export enum EventSource {
  USER = 'USER',
  SYSTEM = 'SYSTEM'
}
```

### `EventType`
```typescript
export enum EventType {
  UserMessageReceived = 'UserMessageReceived'
}
```

### `Event<TPayload>`
```typescript
export interface Event<TPayload = unknown> {
  id: string;
  type: EventType | string;
  source: EventSource | string;
  timestamp: number;
  payload: TPayload;
}
```

### Payload de `UserMessageReceived`
```typescript
export interface UserMessageReceivedPayload {
  message: string;
  projectId?: string;
  sessionId?: string;
}
```

### `EventLog`
```typescript
export interface EventLog {
  append(event: Event): Promise<void>;
  getAll(): Promise<Event[]>;
}
```

## Validación Mínima (En el método `append` o en un `EventValidator` auxiliar)
- Rechazar si falta `id`.
- Rechazar si falta `type`.
- Rechazar si falta `source`.
- Rechazar si falta `timestamp`.
- Rechazar si `payload` es `undefined`.
- *No validar (por ahora) esquemas complejos dentro del payload.*

## Tests Mínimos
- `[ ]` Append de un evento válido debe ser exitoso.
- `[ ]` Recuperación de eventos usando `getAll()` debe mantener el orden cronológico.
- `[ ]` `getAll()` no debe exponer referencias mutables internas (debe devolver una copia superficial/profunda del array).
- `[ ]` Lanzar error controlado (ej. `FrameworkError`) ante un evento mal formado (faltan atributos).
- `[ ]` El `EventLog` debe inicializarse vacío (`getAll()` retorna `[]`).

## Criterios de Aceptación
- La suite de tests de `InMemoryEventLog` pasa exitosamente.
- Los tipos están correctamente inferidos y protegidos con TypeScript.
- No hay dependencias ajenas inyectadas.
- Las pruebas de la CLI y del entorno preexistente siguen en verde (asegurando que no se rompió nada).

## Fuera de Alcance Explícito
- No tocar `Kernel.ts`.
- No tocar CLI.
- No tocar LLM adapters.
- No implementar `AgentKernel`.
- No implementar `StateResolver`.
- No implementar skills.
- No implementar routing.
- No implementar PolicyEngine.
- No implementar persistencia en disco.
- No agregar dependencias de terceros (como `uuid` o esquemas pesados; `id` puede ser un simple `Date.now().toString()` o `crypto.randomUUID()` nativo).

## Riesgos Técnicos
- Fuga de mutabilidad: Si `getAll()` devuelve el array directo de memoria, alguna otra parte del sistema podría mutar el historial sin llamar a `append()`. Es crítico hacer copias (`[...this.events]`).
- Contaminación cruzada en tests unitarios si el mismo `InMemoryEventLog` global es reutilizado (instanciar uno nuevo por test).

## Siguiente Paso Recomendado
Proceder inmediatamente a la fase de ejecución para **escribir el código** de `core/events/` y `tests/core/events/InMemoryEventLog.test.ts`.
