# Sprint 7: AgentFactory e Integración CLI Opcional

## Objetivo del Sprint
Proveer una puerta de entrada manejable para el `AgentKernel` recién creado y exponerlo como una alternativa opcional (`opt-in`) dentro de la interfaz de línea de comandos (CLI). 

Para lograr esto, construiremos una `AgentFactory` que encapsule la compleja lógica de inyección de dependencias (las 7 dependencias requeridas por `AgentKernel`), y adaptaremos el `cli.ts` para que pueda rutear los mensajes del usuario hacia el orquestador agéntico en lugar del `Kernel.ts` legacy **solamente si el usuario lo solicita explícitamente**.

## Decisión de Interfaz de Usuario (CLI Flag)
### Opciones Evaluadas:
1. `--mode legacy|agent`
2. `--agent`
3. `--runtime legacy|agent`

**Recomendación:** Utilizar el flag booleano `--agent`.
*Justificación:* Minimiza la fricción cognitiva. Dado que la restricción fundamental es **mantener el flujo legacy intacto por defecto**, forzar al usuario a teclear `--mode legacy` o lidiar con validación de strings es innecesario. Un simple flag booleano `--agent` activa la arquitectura agéntica de forma elegante y rápida, manteniendo el comportamiento histórico impecable en su ausencia.

## Comportamiento Esperado
- **Sin flag `--agent`**: El CLI instancia y rutea el input hacia `core/kernel/Kernel.ts` (Comportamiento legacy actual garantizado).
- **Con flag `--agent`**: El CLI instancia la arquitectura agéntica usando `AgentFactory`, ejecutando un flujo de una sola pasada.
- **Transversalidad**: Los flags de LLM (ej. `--llm mock`, `--llm openai`) seguirán funcionando e inyectando su respectivo Adapter al motor elegido.
- **Renderizado**: El `Renderer` deberá adaptarse mínimamente para imprimir de forma legible el resultado del `AgentRunResult` o sus errores controlados, sin colapsar.

## Archivos a Crear / Modificar
- `core/agent/AgentFactory.ts` (Nuevo)
- `core/agent/index.ts` (Actualizar exports)
- `apps/cli/cli.ts` (Actualizar parsing de argumentos)
- `apps/cli/CommandHandler.ts` (Actualizar enrutamiento dual y catch de errores)
- `apps/cli/Renderer.ts` (Actualizar pantalla de ayuda y print del resultado)
- `tests/core/agent/AgentFactory.test.ts` (Nuevo)
- `tests/cli/*` (Actualizaciones para confirmar convivencia pacífica entre motores)

## Contratos Propuestos

### `AgentFactory`
La fábrica abstrae el acoplamiento excesivo del Kernel agéntico.
```typescript
import { LLMAdapter } from '../llm/LLMAdapter';
import { AgentKernel } from './AgentKernel';

export class AgentFactory {
  public static create(llmAdapter: LLMAdapter): AgentKernel {
    // 1. Instanciar InMemoryEventLog, StateResolver, ContextBuilder...
    // 2. Instanciar SkillRegistry.
    // 3. Registrar SendMessageSkill.
    // 4. Instanciar ActionExecutor.
    // 5. Retornar new AgentKernel(...)
  }
}
```

## Pruebas Mínimas Requeridas
### `AgentFactory.test.ts`
- `[ ]` Crea y retorna exitosamente una instancia de `AgentKernel`.
- `[ ]` Verifica (si es posible) que el registro interno incluya `SendMessageSkill`.

### `CLI y CommandHandler` (Integración)
- `[ ]` `cli.ts` sin el flag `--agent` invoca al flujo legacy y pasa parámetros correctos.
- `[ ]` `cli.ts` con el flag `--agent` invoca `AgentFactory` y usa `AgentKernel`.
- `[ ]` La inyección del `--llm` correcto (mock por defecto) llega intacta a la Factory.
- `[ ]` El `help` del CLI describe el nuevo flag `--agent`.
- `[ ]` Los errores crudos del `AgentKernel` son renderizados limpiamente por `Renderer.ts`.

## Fuera de Alcance Explícito
- Eliminar o reemplazar por completo `core/kernel/Kernel.ts`.
- Implementar bucles agénticos infinitos (sigue siendo *single-pass*).
- Implementar persistencia de disco o bases de datos vectoriales.
- Añadir nuevas habilidades (Skills).
- Modificar el comportamiento de `OpenAIAdapter`.
- Añadir un `PolicyEngine` o motor de reintentos.
- Cambiar la lógica o salida preexistente cuando NO se usa `--agent`.

## Riesgos Técnicos Identificados
- **Divergencia de Resultados Visuales:** El motor legacy expone `Response` (con sus enums predecibles), mientras que el `AgentKernel` emite `AgentRunResult` (que envuelve un `SkillResult`). El `CommandHandler/Renderer` tendrán que soportar ambos mundos mediante `Type Guards` (Unión de tipos), aumentando la complejidad ciclomática del CLI.
- **Polución del CLI:** `CommandHandler.ts` puede volverse propenso a espagueti si se llenan de bloques `if (this.isAgentMode) { ... } else { ... }`.
- **Llamadas Accidentales:** Riesgo latente de usar `OpenAIAdapter` real en las pruebas de integración CLI si los *mocks* no están rigurosamente definidos a nivel global en la suite de pruebas `apps/cli`.

## Siguiente Paso Recomendado
Realizar el respectivo commit de esta planificación en el documento `docs/TASK_SPRINT_7_CLI_INTEGRATION.md` para asentar las decisiones arquitectónicas, y proceder posteriormente con la codificación de la `AgentFactory` y las inyecciones en la capa CLI.
