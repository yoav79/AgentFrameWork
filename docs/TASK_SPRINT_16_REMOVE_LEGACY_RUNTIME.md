# Planificación Sprint 16: Eliminar Legacy Runtime y establecer AgentKernel como Default

## 1. Objetivo del sprint
- Hacer `AgentKernel` el motor de ejecución por defecto (default).
- Eliminar o aislar completamente `Kernel.ts` (el runtime legacy).
- Quitar la necesidad de usar la bandera `--agent`.
- Mantener `--persist` como una funcionalidad opt-in.
- Validar el correcto funcionamiento de la memoria conversacional en modo interactivo.

## 2. Mapa actual
- **Dónde se instancia `Kernel.ts`**: Actualmente se instancia de forma incondicional en `apps/cli/cli.ts` en la función `bootstrap()`.
- **Dónde se instancia `AgentKernel`**: En `apps/cli/cli.ts`, se instancia mediante `AgentFactory.create(...)` únicamente si la variable `isAgentMode` (derivada de la bandera `--agent`) es verdadera.
- **Cómo funciona actualmente `--agent`**: Esta bandera establece la variable `isAgentMode` a `true` en el CLI, lo que causa que se cree el `AgentKernel` y se le pase al `CommandHandler`. El `CommandHandler` prioriza `AgentKernel` sobre `Kernel` si está definido.
- **Cómo funciona actualmente `--persist`**: Se lee en el CLI y se pasa a las opciones de `AgentFactory.create({ persist: isPersistMode })`. Esto indica a la fábrica de eventos que utilice `FileEventLog` en lugar del log en memoria. Si no está en modo agent, muestra un warning.
- **Tests que dependen de legacy**: 
  - `tests/core/kernel/Kernel.test.ts`
  - Posiblemente tests en `tests/cli/CommandHandler.test.ts` que verifiquen el comportamiento fallback hacia `Kernel`.

## 3. Decisión recomendada sobre legacy
Dado que el producto es nuevo, no está en producción y la base de código ya fue estabilizada en el Sprint 15, la **Opción A (Borrar `Kernel.ts` y tests legacy ahora)** es la recomendada para un MVP limpio y fácil de mantener. No existe necesidad de arrastrar deuda técnica o ambigüedad manteniendo código obsoleto. Esto incluye borrar `Kernel.ts`, sus interfaces exclusivas y `Kernel.test.ts`.

## 4. Decisión recomendada sobre `--agent`
Se recomienda **mantenerlo como un alias sin efecto pero mostrando un warning de deprecación**. Esto previene que scripts o comandos que ya se estaban probando fallen abruptamente, pero notifica al usuario que la bandera ya no es necesaria porque el comportamiento es ahora el predeterminado.

## 5. Comportamiento esperado
- Ejecutar `npx tsx apps/cli/cli.ts "hola"` usa `AgentKernel` (sin necesidad de `--agent`).
- Ejecutar `npx tsx apps/cli/cli.ts --persist "hola"` usa `AgentKernel` con `FileEventLog`.
- El modo interactivo (`npx tsx apps/cli/cli.ts`) utiliza una sola instancia de `AgentKernel` mantenida a lo largo de la sesión REPL.
- El comando interno `/use <workspace>` alimenta correctamente el `projectId` (o su contexto equivalente) hacia las iteraciones subsecuentes del agente.
- La memoria funciona de manera fluida y retiene el contexto dentro de la misma sesión interactiva (incluso sin `--persist`).

## 6. Test crítico
Se debe implementar un test de integración robusto sin depender de respuestas exactas del LLM (mockeando el LLMAdapter):
- **Simular dos mensajes consecutivos:**
  1. `me llamo Yoab`
  2. `como me llamo?`
- **Aserción:** Verificar que en la invocación del LLM para el segundo mensaje, el prompt (o historial) enviado contenga la sección `Recent Memory` o el contexto equivalente y la cadena `me llamo Yoab`. No se debe depender del output específico del modelo.

## 7. Archivos probables a modificar
- `apps/cli/cli.ts` (eliminar instanciación de `Kernel`, quitar lógica dependiente de `--agent`).
- `apps/cli/CommandHandler.ts` (eliminar dependencias de `Kernel` y `ContextFactory`, usar `AgentKernel` exclusivamente).
- `apps/cli/Renderer.ts` (quitar dependencias de tipos de respuesta legacy si aplica, actualizar textos de ayuda).
- `tests/cli/CommandHandler.test.ts` (actualizar mocks y dependencias para remover `Kernel`).
- `tests/cli/cli.test.ts` y tests de index (si existen).
- `tests/core/agent/AgentKernel.test.ts` (garantizar que pasa con las nuevas integraciones).
- `tests/core/kernel/Kernel.test.ts` (**ELIMINAR**).
- `core/kernel/Kernel.ts` y dependencias exclusivas (**ELIMINAR**).
- `README.md` (actualizar documentación de uso de flags, eliminando `--agent` como requerimiento).

## 8. Fuera de alcance
- **NO** implementar `ReadFileSkill`.
- **NO** implementar capacidades de self-correction.
- **NO** implementar reintentos (retries) ante fallos.
- **NO** añadir nuevas políticas (policies).
- **NO** implementar bases de datos SQLite.
- **NO** implementar soporte de embeddings.
- **NO** hacer refactors grandes de dependencias (ej. `AgentDependencies` o Inyección de dependencias compleja) salvo que sea estrictamente necesario para remover el legacy.
