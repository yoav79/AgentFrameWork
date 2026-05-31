# Sprint 4: Contratos de Skills y Registro Mínimo

## Objetivo del Sprint
Introducir la capa operativa de "habilidades" (Skills) del motor agéntico. Esto involucra definir el contrato genérico `Skill`, el contrato de respuesta `SkillResult`, y construir un `SkillRegistry` en memoria capaz de localizar habilidades según la intención demandada (`actionType`). Adicionalmente, se implementará la primera habilidad pasiva: `SendMessageSkill`.

Esta capa se mantendrá estática y aislada; la orquestación real (el puente entre Decision y Skill) queda reservada para el *Sprint 5 (ActionExecutor)*.

## Alcance Estricto
Definir contratos base, crear el registro de habilidades, programar la lógica base de una habilidad (`SendMessageSkill`), e implementar los tests unitarios que aseguren que todo el ruteo interno funciona. No se integrará con el CLI, ni se renderizará salida a consola, ni se orquestarán flujos de LLM.

## Archivos a Crear / Modificar
- `core/skills/Skill.ts` (Nuevo)
- `core/skills/SkillResult.ts` (Nuevo)
- `core/skills/SkillRegistry.ts` (Actualizar placeholder existente)
- `core/skills/SendMessageSkill.ts` (Nuevo)
- `core/skills/index.ts` (Actualizar exports)
- `tests/core/skills/SkillRegistry.test.ts` (Nuevo)
- `tests/core/skills/SendMessageSkill.test.ts` (Nuevo)

## Archivos que NO se deben tocar
- `core/kernel/Kernel.ts`
- `apps/cli/CommandHandler.ts`
- `apps/cli/cli.ts`
- `core/llm/*`
- `core/events/*`
- `core/routing/DecisionParser.ts` (Aún no se conecta)
- Módulos de persistencia, CLI o estado.

## Contratos Propuestos

### `SkillResult`
```typescript
export interface SkillResult {
  success: boolean;
  message?: string;
  data?: Record<string, unknown>;
  error?: string;
}
```

### `Skill`
```typescript
import { SkillResult } from './SkillResult';

export interface Skill {
  name: string;
  description: string;
  canHandle(actionType: string): boolean;
  execute(input: unknown): Promise<SkillResult> | SkillResult;
}
```

### `SkillRegistry`
```typescript
import { Skill } from './Skill';
import { FrameworkError } from '../errors/FrameworkError';

export class SkillRegistry {
  public register(skill: Skill): void { /* ... */ }
  public getSkillForAction(actionType: string): Skill | undefined { /* ... */ }
}
```

### `SendMessageSkill`
- Implementa `Skill`.
- Retorna `true` en `canHandle` solo si `actionType === 'send_message'`.
- El método `execute(input)` debe emular un retorno exitoso sin imprimir a consola (el renderizado se encargará de eso en sprints posteriores).

## Tests Mínimos

### `SkillRegistry.test.ts`
- `[ ]` Permite registrar una skill válida.
- `[ ]` Evita o rechaza el registro de skills con el mismo `name`.
- `[ ]` Encuentra y retorna una skill usando `actionType`.
- `[ ]` Devuelve `undefined` o lanza error controlado si no hay skill compatible.

### `SendMessageSkill.test.ts`
- `[ ]` `canHandle('send_message')` devuelve `true`.
- `[ ]` `canHandle('none')` o cualquier otro devuelve `false`.
- `[ ]` `execute()` devuelve un `SkillResult` válido con `success === true`.
- `[ ]` Garantiza que no existen llamadas al CLI, LLM, ni emisiones de eventos.

## Fuera de Alcance Explícito
- No implementar `ActionExecutor` (El módulo que ejecutará la acción).
- No conectar `DecisionParser` con el `SkillRegistry`.
- No modificar el flujo interactivo (CLI) ni `Kernel.ts`.
- No implementar `AgentKernel`.
- No emitir eventos de resultado (`MessageSent`, `ActionFailed`, etc.).
- No implementar `PolicyEngine` ni reglas de autorización de skills.
- No agregar persistencia ni dependencias de terceros.
- No agregar otras skills más allá de `SendMessageSkill`.

## Riesgos Técnicos
- **Contrato prematuro:** La firma `execute(input: unknown)` es muy permisiva y podría requerir una refactorización hacia Genéricos estrictos en el futuro para asegurar la forma del payload de cada skill.
- **Validación del payload:** Al no existir validación fuerte en el `execute()`, la habilidad `SendMessageSkill` asume que recibirá un objeto válido de decisión, lo cual puede generar errores si `proposedAction.payload` está vacío o malformado.
- **Duplicados:** Controlar unicidad por nombre podría generar conflictos si en el futuro se implementan namespaces o plugins de terceros.
- **Confusión Skill/Renderer:** Es fácil caer en la tentación de hacer un `console.log` dentro de la skill, pero esto rompería el aislamiento arquitectónico. La skill debe regresar puros datos.

## Siguiente Paso Recomendado
Realizar commit de este roadmap (`docs/TASK_SPRINT_4_SKILLS.md`) para versionarlo, y posteriormente transicionar a la fase de Ejecución de este Sprint 4.
