# Sprint 5: ActionExecutor y Conexión de Decisiones con Habilidades

## Objetivo del Sprint
Construir el `ActionExecutor`, el componente orquestador responsable de cerrar el ciclo entre la salida estructurada del LLM (`Decision`) y la capa operativa en memoria (`SkillRegistry`). 

Este componente tomará la decisión validada, buscará la habilidad correspondiente basándose en el tipo de acción propuesta, inyectará el *payload* y retornará el resultado oficial (`SkillResult`), logrando así una ejecución agéntica determinista y controlada.

## Alcance Estricto
- Desarrollar la clase `ActionExecutor`.
- Inyectar el `SkillRegistry` dentro de `ActionExecutor` (vía constructor) para permitir el desacoplamiento y testabilidad.
- Procesar un objeto `Decision` formal y ejecutar la habilidad si el `intent` permite ejecución (ej. evitar acciones si el `intent` es `'unknown'`).
- Escribir tests unitarios exhaustivos validando escenarios de éxito, habilidades no encontradas, y fallos de ejecución internos.
- **Mantener el aislamiento:** Todavía no se modifica el flujo interactivo CLI, el `Kernel.ts` legacy, ni se interactúa asíncronamente con LLMs reales.

## Archivos a Crear / Modificar
- `core/routing/ActionExecutor.ts` (Nuevo)
- `core/routing/index.ts` (Añadir export)
- `tests/core/routing/ActionExecutor.test.ts` (Nuevo)

## Archivos que NO se deben tocar
- `core/kernel/Kernel.ts`
- `apps/cli/CommandHandler.ts`
- `apps/cli/cli.ts`
- `core/llm/*`
- `core/events/*`
- `core/state/*`

## Contrato Propuesto

### `ActionExecutor`
```typescript
import { Decision } from '../schemas/Decision';
import { SkillRegistry } from '../skills/SkillRegistry';
import { SkillResult } from '../skills/SkillResult';

export class ActionExecutor {
  constructor(private readonly registry: SkillRegistry) {}

  public async execute(decision: Decision): Promise<SkillResult> {
    // 1. Validar si el intent permite ejecución (ej. si es 'unknown', abortar).
    // 2. Si proposedAction.type === 'none', retornar un success temprano.
    // 3. Buscar la skill: this.registry.getSkillForAction(decision.proposedAction.type)
    // 4. Si no existe, retornar SkillResult con error.
    // 5. Si existe, invocar await skill.execute(decision.proposedAction.payload)
    // 6. Retornar el SkillResult.
  }
}
```

## Pruebas Mínimas (`tests/core/routing/ActionExecutor.test.ts`)
- `[ ]` Retorna `success: true` automáticamente si `proposedAction.type === 'none'`.
- `[ ]` Falla limpia y explícitamente (`success: false`, `error: ...`) si la skill solicitada no está registrada en el `SkillRegistry`.
- `[ ]` Delega exitosamente la ejecución a una Skill mockeada y retorna su `SkillResult` de forma transparente.
- `[ ]` Maneja proactivamente rechazos o excepciones inesperadas provenientes del método `execute` de la habilidad (Try/Catch).
- `[ ]` (Opcional pero recomendado) Evalúa el comportamiento si el `intent` es explícitamente `unknown` (¿Se debe ejecutar la acción o abortar preactivamente?).

## Fuera de Alcance Explícito
- No se creará todavía el `AgentKernel` maestro que junta los Sprints 1 a 5 en un *pipeline* completo.
- No se emitirán ni guardarán eventos de resultados en el `EventLog` todavía (Esto es material de Sprint 6).
- No se conectará con el `CLI` ni se reemplazará la arquitectura actual (`Kernel.ts`).

## Riesgos Técnicos Identificados
- **Captura de Excepciones:** Si una Skill está mal desarrollada y lanza un `throw new Error(...)` directamente en lugar de retornar un `SkillResult` con `success: false`, el `ActionExecutor` podría romper el ciclo asíncrono si no está envuelto en un bloque `try/catch` riguroso.
- **Asincronía Mixta:** El contrato de `Skill` estipula que `execute` puede retornar `SkillResult | Promise<SkillResult>`. El `ActionExecutor` debe garantizar el manejo unificado esperando (`await`) la resolución de la promesa en todos los casos de forma segura.

## Siguiente Paso Recomendado
Realizar el commit de este roadmap (`docs/TASK_SPRINT_5_ACTION_EXECUTOR.md`) y dar paso a la implementación controlada de la clase `ActionExecutor` y sus tests unitarios.
