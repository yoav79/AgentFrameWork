# Planificación Sprint 16 Fase 2: Eliminación Física de Artefactos Legacy

## 1. Objetivo
- **Eliminar código legacy físico** que dejó de usarse en la Fase 1 tras establecer `AgentKernel` como el único runtime.
- **Reducir la deuda técnica** purgar clases, interfaces y tests muertos, minimizando el tamaño del codebase.
- **Mantener `AgentKernel`** como la pieza central de orquestación, sin regresar a esquemas de fallback.
- **Preservar la suite de tests y typecheck en verde**, asegurando una transición libre de regresiones.

## 2. Mapa de artefactos legacy
Se realizó un escaneo profundo en el proyecto para trazar el árbol de dependencias:
- **`core/kernel/`**: Contiene `Kernel.ts` y `KernelOptions.ts`. Estos archivos están **realmente muertos**, su único punto de entrada era el CLI (el cual ya no los invoca).
- **`core/context/ContextFactory.ts` y `ExecutionContext.ts`**: Totalmente desvinculados del flujo activo. El CLI inyecta directamente `AgentRunInput` al `AgentKernel`, por lo que ya no existe orquestación que dependa del `ContextFactory`.
- **`core/response/`**: Contiene `ResponseNormalizer`, `ResponseSchemaFactory` y `ResponseValidator`. Todo este módulo estaba diseñado para producir y validar `FrameworkResponse`, un modelo exclusivo del viejo Kernel. `AgentKernel` utiliza `AgentRunResult` y su propio `DecisionParser`, por lo tanto, el módulo response está **muerto**.
- **`apps/cli/Renderer.ts`**: Contiene fragmentos de código legacy (`if (response.type === 'message')`) creados para pintar un `FrameworkResponse`.

## 3. Candidatos a eliminar (Borrado Físico)
- Directorio `core/kernel/` completo (`Kernel.ts`, `KernelOptions.ts`, `index.ts`).
- Directorio `tests/core/kernel/` completo.
- Directorio `core/response/` completo (`ResponseNormalizer.ts`, `ResponseSchemaFactory.ts`, `ResponseValidator.ts`, `index.ts`).
- Directorio `tests/core/response/` completo.
- Archivos `core/context/ContextFactory.ts` y `core/context/ExecutionContext.ts`.
- Archivos de prueba `tests/core/context/ContextFactory.test.ts`.

## 4. Candidatos a conservar (Componentes Críticos)
- **`core/context/ContextBuilder.ts`** y **`core/context/PromptBuilder.ts`**: No deben tocarse. Son dependencias directas del flujo activo de `AgentKernel`.
- **`core/agent/AgentKernel.ts`** y dependencias: Son el core actual.
- **`apps/cli/Renderer.ts`**: Debe conservarse, pero se debe limpiar de renderizados legacy si es posible, dejando un fallback robusto para `AgentRunResult`.

## 5. Cambios probables
- Eliminar físicamente los archivos y directorios enlistados arriba.
- Actualizar los archivos `index.ts` (por ejemplo, `core/context/index.ts` para que deje de exportar el Factory, y posibles barriles (barrels) superiores como `core/index.ts` si existieran).
- Limpiar `apps/cli/Renderer.ts` y sus respectivos tests (`tests/cli/Renderer.test.ts`) quitando la validación estricta de `FrameworkResponse`.
- Actualizar el `README.md` para eliminar definitivamente la jerga de "Legacy" y documentar la arquitectura asumiendo el agente de manera nativa y directa.

## 6. Tests requeridos
Tras la eliminación se deberá correr el flujo estándar para asegurar integridad:
- `npm run typecheck` (vital para asegurar que no hay dependencias fantasma).
- `npm test`
- `npx vitest run tests/cli/`
- `npx vitest run tests/core/agent/`
- `npx vitest run tests/core/context/`

## 7. Fuera de alcance explícito
- **NO** desarrollar nuevas skills (ej. `ReadFileSkill`).
- **NO** añadir utilidades de File I/O o System calls.
- **NO** implementar algoritmos de auto-corrección o retries.
- **NO** refactorizar la inyección de dependencias (`AgentDependencies`).
- **NO** alterar reglas del `PolicyEngine`.
- **NO** cambiar componentes lógicos de memoria o event sourcing.

## 8. Riesgos técnicos
- **Imports Rotos**: Que alguna interfaz como `ExecutionContext` sea usada en alguna parte oculta de utilidades (ej. `Logger`), rompiendo el build en `tsc`.
- **Exports Muertos**: Que el usuario importe del framework dependencias que ya no existen, rompiendo la API pública.
- **Tests con Falsos Positivos**: Es crítico asegurar que la carpeta de tests quede libre de `Kernel.test.ts`, ya que vitest fallaría si el test no encuentra sus dependencias base.
- **Sobreescritura de Renderer**: Al borrar el manejo en `Renderer.ts`, debemos asegurar de no romper la impresión genérica de errores para un crash absoluto.
