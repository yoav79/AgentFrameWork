# Registro de Deuda Técnica - AgentFrameWork

Este documento cataloga los aspectos del código, del compilador o del diseño arquitectónico que presentan fricciones o deudas pendientes que requieren atención a corto/mediano plazo.

---

## 1. Deuda de Compilación (TypeScript / Type Checking)
- **Error TS18046 en Tests de SearchUrlTool**:
  - Al ejecutar `npm run typecheck` (`tsc --noEmit`), se presenta la siguiente falla:
    ```
    tests/plugins/tools/SearchUrlTool.test.ts:46:14 - error TS18046: 'result.data.snippets' is of type 'unknown'.
    46       expect(result.data?.snippets[0]).toContain('special keyword here');
    ```
  - **Causa**: El campo `data` dentro de la interfaz `ToolResult` se tipifica como `unknown`. En el archivo de test, se asume implícitamente que es una estructura de objeto sin realizar una validación de esquema, aserción de tipo, o casting explícito.
  - **Solución recomendada**: Aplicar un casting explícito en el test (ej. `(result.data as any).snippets` o validación estructurada) para satisfacer al compilador estricto de TypeScript.

---

## 2. Deuda de Robustez de Datos (DecisionParser vs OpenAI)
- **Dependencia de Expresiones de Fallback**:
  - Aunque se agregaron normalizadores para remapear intents inválidos (`none`, `greet`, etc.) y corregir payloads vacíos (`proposedAction: {}`), estas son medidas de mitigación post-procesado de texto.
  - **Riesgo**: Si un modelo futuro de LLM devuelve otra variante de formato no contemplada, el motor fallará en la validación.
  - **Solución recomendada**: Migrar la generación hacia la API de **OpenAI Structured Outputs** (forzando una validación estricta de JSON Schema a nivel API) o usar un validador robusto basado en librerías de validación de esquemas de TypeScript (ej. Zod) que ofrezca tipado seguro y coerción automática.

---

## 3. Deuda en el Proceso de Construcción (Build-Step) de Plugins
- **Compilación de Plugins Obligatoria**:
  - En la CLI (`apps/cli/cli.ts`), el comando `npm run dev` depende del script intermedio `npm run build:plugins` para compilar los TypeScript de plugins a JavaScript (`CJS` mediante `esbuild`) bajo `dist/plugins/tools/`.
  - **Causa**: El cargador dinámico `PluginLoader` busca directamente archivos `.js` compilados. Si un desarrollador edita un plugin en TypeScript y olvida reconstruirlo, o si se corre `cli.ts` sin un paso de compilación previo, el sistema cargará versiones obsoletas de las herramientas o arrojará excepciones.
  - **Solución recomendada**: Adaptar el `PluginLoader` en modo de desarrollo para cargar directamente archivos `.ts` (utilizando `tsx` u optimizaciones de registro sobre la marcha como `ts-node`/`tsx`) sin requerir un build-step imperativo.

---

## 4. Deuda en la Recuperación ante Errores de Herramientas
- **Corte de Turno por Error de Herramienta (`stopOnToolError`)**:
  - Si una herramienta de lectura o escritura falla (ej: archivo inexistente o permisos denegados), el motor detiene inmediatamente el bucle agéntico considerándolo una falla irrecuperable.
  - **Causa**: Limitación en las políticas de auto-corrección de `FlowEngine.ts`.
  - **Solución recomendada**: Permitir que el error en la ejecución de la herramienta se devuelva al LLM como parte del contexto para que este razone sobre el problema (ej: ruta mal ingresada) y decida proponer una corrección por sí mismo en el siguiente paso.

---

## 5. Deuda de Sincronización en Documentación
- **README y Ayuda de Comandos (`Renderer.ts` / `/help`)**:
  - Varias de las tablas de comandos descritas en el archivo de bienvenida del repositorio (`README.md`) y el comando `/help` del REPL listan opciones como `/session` y `/list` bajo un estado "Simulado", cuando actualmente ya se encuentran completamente implementadas y persistidas a nivel de archivo de proyecto.
  - El flag obsoleto `--agent` sigue listado a pesar de que el kernel predeterminado es el `AgentKernel` de forma mandatoria.
