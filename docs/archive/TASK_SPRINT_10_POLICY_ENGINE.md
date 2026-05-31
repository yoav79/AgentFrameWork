# Sprint 10: Policy Engine Mínimo y Aislado

## Objetivo del Sprint
Implementar una capa determinista de autorización (`PolicyEngine`) diseñada para interceptar y evaluar una `Decision` antes de que alcance el `ActionExecutor`. El objetivo primordial es dotar al sistema de salvaguardas que impidan a la IA ejecutar acciones no autorizadas, destructivas, o con bajo nivel de confianza.

En este sprint, el motor se construirá y probará en **estricto aislamiento**. No se conectará al `AgentKernel` ni modificará el CLI todavía.

## Ubicación Recomendada de los Archivos
Se recomienda alojar esta capa en el subdirectorio `core/policy/` en lugar de `core/security/`. 
**Justificación:** En el paradigma de Agentes Autónomos, las "políticas" (Policies) trascienden la seguridad tradicional (autenticación/cifrado). Gobiernan restricciones de negocio, costos (uso de LLM), flujos de trabajo permitidos según la fase del proyecto y heurísticas de confianza. `core/policy/` semánticamente encaja de manera perfecta con este propósito.

**Estructura propuesta:**
- `core/policy/PolicyDecision.ts`
- `core/policy/PolicyEngine.ts`
- `core/policy/index.ts`
- `tests/core/policy/PolicyEngine.test.ts`

## Contratos Mínimos Propuestos

### `PolicyDecision`
Representa el veredicto explícito del motor tras evaluar una decisión.
```typescript
export interface PolicyDecision {
  allowed: boolean;
  reason?: string;
  severity?: 'info' | 'warning' | 'critical';
}
```

### `PolicyEngine`
```typescript
import { Decision } from '../schemas/Decision';
import { PolicyDecision } from './PolicyDecision';

export class PolicyEngine {
  public evaluate(decision: Decision): PolicyDecision {
    // Lógica determinista de evaluación
  }
}
```

## Reglas Mínimas Iniciales (Hardcoded MVP)
El motor actuará como un Firewall semántico con las siguientes reglas estáticas:
1. **Permitir siempre `none`:** Si `proposedAction.type === 'none'`, se aprueba sin importar la confianza (es inofensivo).
2. **Umbral de Confianza (`Confidence`):** Si `confidence < 0.6`, **rechazar** automáticamente la decisión, sin importar la acción.
3. **Acciones Aprobadas:** Permitir `send_message` explícitamente solo si cumple la regla de confianza (`>= 0.6`).
4. **Denegación por Defecto:** Cualquier acción cuyo `type` no esté explícitamente en la lista blanca de permitidos, será rechazada.
5. **Inmutabilidad:** El motor solo retorna el veredicto; jamás modifica la `Decision` original ni ejecuta acciones (Side-effect free).

## Pruebas Mínimas Requeridas (`PolicyEngine.test.ts`)
- `[ ]` Permite `send_message` cuando el `confidence` es alto (ej. `0.8`).
- `[ ]` Rechaza `send_message` devolviendo `allowed: false` cuando el `confidence` es bajo (ej. `0.3`).
- `[ ]` Permite la acción inerte `none` incluso con `confidence` en `0.1`.
- `[ ]` Rechaza tajantemente cualquier `action type` desconocido (ej. `delete_files`) independientemente de la confianza.
- `[ ]` El rechazo devuelve un `reason` descriptivo y legible.
- `[ ]` La invocación del motor es pura y no muta el objeto `Decision` de entrada.
- `[ ]` (Aislamiento) Los tests se corren sin instanciar el `ActionExecutor` y sin *mockear* el LLM (el motor debe operar sobre simples diccionarios JSON mapeados a la interfaz `Decision`).

## Fuera de Alcance Explícito
- No se conectará el `PolicyEngine` dentro del método `AgentKernel.run()` en este sprint.
- No se inyectará en el `AgentFactory` ni interactuará con el CLI.
- No se modificará el `ActionExecutor`.
- No se desarrollará un sistema dinámico de políticas cargables desde archivos `.json` o bases de datos (todo será hardcoded para este MVP).
- No se implementarán políticas basadas en Control de Acceso por Roles de usuario (RBAC).
- No se agregará ninguna dependencia externa de validación de reglas (ej. Casbin).

## Riesgos Técnicos Identificados
- **Falsa Sensación de Seguridad:** Un motor hardcoded puede engañarnos sobre la solidez del framework si no advertimos tempranamente la necesidad de reglas dinámicas basadas en contexto.
- **Reglas Demasiado Estrictas/Simples:** El bloqueo por un umbral estático de `0.6` puede frustrar el flujo si la temperatura del LLM fluctúa en inferencias válidas pero inherentemente inseguras.
- **Deuda Técnica de Integración:** Cuando llegue el Sprint 11, será un desafío determinar dónde ubicar el Engine dentro del pipeline: ¿Debe el `AgentKernel` llamar al Engine, y si el Engine falla, solicitarle otra inferencia al LLM? ¿O debe el `AgentKernel` simplemente cancelar la pasada (single-pass fail)?

## Siguiente Paso Recomendado
Realizar el commit de esta planificación en `docs/TASK_SPRINT_10_POLICY_ENGINE.md`. Con el mapa trazado, procederemos a desarrollar el motor en modo "Implementación Controlada" y validar sus aserciones.
