# Sprint 12: Auditoría y Eventos de Resultado del Ciclo Agéntico

## Objetivo del Sprint
Implementar una trazabilidad formal en el ciclo vital del Agente. Actualmente el framework registra asíncronamente el estímulo de entrada (`UserMessageReceived`), pero adolece de memoria respecto a sus propias acciones y fracasos. 
En este sprint, facultaremos al `AgentKernel` para realizar un *append* de eventos semánticos al `EventLog` (sea en RAM o en Disco), grabando a fuego los dictámenes del `PolicyEngine` y los desenlaces del `ActionExecutor`.

## Eventos Propuestos

### Nuevos Eventos de Dominio
1. **`PolicyRejected`**: Emitido cuando el guardián de políticas bloquea la inferencia.
2. **`ActionExecuted`**: Emitido cuando una *Skill* culmina su ejecución con un `success: true`.
3. **`ActionFailed`**: Emitido cuando una *Skill* explota internamente o no logra ejecutarse (`success: false`).

### Recomendación sobre `DecisionParsed`
**Recomendación:** *Excluir del MVP.*
**Justificación:** Si registramos un evento `DecisionParsed` por cada pasada, corremos el riesgo de duplicar entropía innecesaria en el log. Todo `DecisionParsed` válido culminará inmediatamente en un `ActionExecuted`, un `ActionFailed` o un `PolicyRejected`. Al registrar directamente el desenlace final incluyendo el `actionType`, obtenemos la misma huella semántica con la mitad de eventos persistidos, controlando así el crecimiento de los JSONs.

## Payloads Mínimos
Modificaremos la topología de la interfaz `EventPayload` aglutinando:

```typescript
export interface PolicyRejectedPayload {
  reason: string;
  severity?: string;
  actionType?: string;
  confidence?: number;
}

export interface ActionExecutedPayload {
  actionType: string;
  success: boolean;
  message?: string;
}

export interface ActionFailedPayload {
  actionType: string;
  error: string;
}
```

## Modificaciones Arquitectónicas Probables
- `core/events/EventType.ts`: Registrar los 3 nuevos enums.
- `core/events/Event.ts`: Alojar la topología de los nuevos Payloads.
- `core/agent/AgentKernel.ts`: En el método `.run()`, ejecutar `this.eventLog.append(...)` estratégicamente en el flujo de control de rechazo del *PolicyEngine* y justo después del *ActionExecutor*.
- Actualización sistemática de la suite de Tests del Kernel para asegurar el conteo de eventos y su encadenamiento temporal.

## Comportamiento Estricto
- Todo ciclo comenzará con un `UserMessageReceived`.
- Si el `PolicyEngine` determina un `allowed: false`, el núcleo inyectará un `PolicyRejected` y terminará el proceso retornando el error de forma limpia. Jamás llamará a ejecución.
- Si la política autoriza el flujo, se ejecutará el comando. Si su respuesta es exitosa, se grabará un `ActionExecuted`. Si fracasa, se grabará un `ActionFailed`.
- El flujo legado de `Kernel.ts` no registrará estos eventos.
- No se auto-corregirá nada: el fallo simplemente se audita y el proceso muere devolviendo un `AgentRunResult` al cliente.

## Pruebas Mínimas Requeridas
- `[ ]` `AgentKernel.test.ts`: Una baja confianza en el prompt desencadena el log de `PolicyRejected`. La longitud del `eventLog.getAll()` asciende a 2.
- `[ ]` `AgentKernel.test.ts`: El *Happy Path* termina guardando un `UserMessageReceived` seguido de un `ActionExecuted`.
- `[ ]` `AgentKernel.test.ts`: Si la *Skill* falla limpiamente (`success: false` sin excepciones), el sistema audita un `ActionFailed`.
- `[ ]` Los eventos quedan registrados con su orden cronológico y guardan su fuente causal `EventSource.SYSTEM` (o similar).
- `[ ]` Con el `EventLogFactory` en modo Persistente, todos estos nuevos eventos logran decodificarse/serializarse correctamente en un File System efímero.

## Fuera de Alcance Explícito
- No implementaremos el patrón `EventEmitter` (no hay observadores reaccionando en vivo a estos eventos).
- No implementaremos `Retries` automatizados si vemos un `ActionFailed`.
- No implementaremos una nueva *Skill* para que el agente lea su propio log.
- No instalaremos Base de Datos relacional ni migraremos el FileEventLog.
- No incluiremos configuración de seguridad mediante JSONs.

## Riesgos Técnicos Identificados
- **Correlación Temporal (RunId):** Actualmente cada `append` vive aislado. Si lanzamos múltiples corridas en la misma terminal, será difícil discernir a nivel puramente de logs qué `PolicyRejected` pertenece a qué `UserMessageReceived`. Por ahora asumiremos concurrencia síncrona simple, pero la falta de un *runId* atómico pasará factura pronto.
- **Payloads Expansivos:** Si el `message` del `ActionExecutedPayload` trae la respuesta de red de un archivo de 5MB, el `events.json` colapsará rápidamente de tamaño.
- **Exposición de Secretos:** Al persistir los payload crudos, podríamos sin querer auditar `ApiKeys` si una Skill recibe configuraciones sensibles en su payload.

## Siguiente Paso Recomendado
Registrar oficialmente la planificación vía `git commit` de `docs/TASK_SPRINT_12_RESULT_EVENTS_AUDIT.md`. Acto seguido, entraremos a modo implementación actualizando los Contratos de Eventos y forzando al Kernel a escribir su bitácora.
