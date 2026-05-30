# Planificación Sprint 19B: Integración Agéntica de ReadFileTool

## 1. Objetivo
- Integrar orgánicamente la `ReadFileTool` al flujo de pensamiento del Agente.
- Permitir que el LLM emita la acción `read_file` como parte de su toma de decisiones.
- Proteger el File System definiendo claramente los límites del *workspace* (baseDir).
- Evitar que el contenido extenso de los archivos sature los *Event Logs* persistentes o genere fugas de contexto incontrolables.

## 2. Estado Actual (Punto de Partida)
- `ReadFileTool`: Implementada, probada y aislada contra vulnerabilidades (Sprint 19A).
- `ToolRegistry` & `ActionExecutor`: Conectados y listos (Sprint 18).
- `AgentFactory`: Crea el registro de herramientas pero lo deja vacío.
- `DecisionParser` / `Decision`: El tipo `read_file` no está declarado en el esquema, por lo que el *parser* lo rechazaría automáticamente.
- `PolicyEngine`: No tiene reglas sobre herramientas de lectura, bloqueando por defecto o dejando pasar sin chequeo de *confidence* alto.

## 3. Decisión Crítica: *baseDir* Seguro
¿De dónde saca el agente la ruta segura donde puede leer?
- **Decisión recomendada (MVP):** **Extender las opciones del `AgentFactory`**.
- `AgentFactory.create(llmAdapter, options)` debe poder recibir un `workspaceRoot: string` explícito.
- **Modo Global:** Si el CLI se ejecuta sin `--project` o sin `/use` (es decir, modo global), el CLI pasará `process.cwd()` como `workspaceRoot`. Esto limita al agente estrictamente a la carpeta desde donde se invocó el CLI.
- **Modo Proyecto:** Si hay un proyecto activo, el CLI resolverá la carpeta física del proyecto en `~/.agentframework/projects/<workspace>` y pasará esa ruta absoluta como `workspaceRoot`.
- **Ventaja:** La seguridad es determinista y el Agente no tiene que adivinar dónde está.

## 4. Cambios Probables en el Código
- **`core/schemas/Decision.ts`**:
  - Ampliar el tipo `ActionType` (o equivalente) para aceptar `"read_file"`.
- **`core/routing/DecisionParser.ts`**:
  - Validar que si `action.type === 'read_file'`, exista estrictamente un `payload.path` que sea tipo `string`.
- **`core/policy/PolicyEngine.ts`**:
  - Agregar una regla dura: Si la acción es `read_file`, el `confidence` debe ser `>= 0.85`. Si es menor, rechazar por seguridad y alucinación.
- **`core/agent/AgentFactory.ts`**:
  - Instanciar `const readFileTool = new ReadFileTool(workspaceRoot);` y registrarlo en el `toolRegistry`.
- **`apps/cli/cli.ts` & `apps/cli/CommandHandler.ts`**:
  - Pasar el `workspaceRoot` explícito hacia la factoría del Agente.

## 5. EventLog y Auditoría (Contenido de Archivos)
- Tras revisar el código fuente de `AgentKernel.ts` en la línea 109 (`actionResult.success`), actualmente **SÓLO se guardan en el log:** `actionType`, `success` y `message`. 
- **Decisión recomendada:** Mantener este comportamiento seguro. NO guardar `data.content` en el `EventLog`.
- Opcionalmente se puede modificar el registro para incluir *metadata* inofensiva (`data.path` y `data.size`), lo que ayuda a auditar qué archivos leyó el agente, sin guardar el megabyte de texto en la memoria persistente de eventos.

## 6. Tests Mínimos Propuestos
- **DecisionParser**: Parsea exitosamente un JSON válido de `read_file`.
- **DecisionParser**: Rechaza o lanza error (Fallback) si se manda `read_file` sin el campo `path`.
- **PolicyEngine**: Aprueba `read_file` con confidence `0.9`. Rechaza con `0.5`.
- **AgentFactory**: Verifica que el registro ya no esté vacío y contenga `read_file`.
- **AgentKernel (Test Integrado)**: Con un `MockLLMAdapter` devolviendo un JSON con la orden `read_file`, el kernel es capaz de ir de extremo a extremo, leer un archivo real en un directorio temporal y devolver el resultado sin explotar el Log.

## 7. Fuera de Alcance Estricto
- NO implementar nuevas Tools (solo integrar `ReadFileTool`).
- NO habilitar capacidades de escritura (`WriteFile`), Shell, edición o borrado.
- NO incorporar búsquedas recursivas (`glob`).
- NO habilitar reintentos de auto-corrección ("Si falla, inténtalo de nuevo con otra ruta"). La herramienta falla de una pasada, el error va al contexto del siguiente turno para que el LLM lo razone naturalmente.

## 8. Riesgos Técnicos (Mitigaciones)
- **Modo Global Ambiguo:** En modo global, `process.cwd()` podría ser la raíz `/` del usuario si ejecutó el CLI allí por accidente. Mitigación: Aunque lea, al ser de **sólo lectura**, el daño sistémico es cero (no puede borrar ni sobreescribir). Solo habría riesgo de exfiltración hacia el LLM.
- **Fuga de Secretos:** Mitigado por las robustas validaciones de extensiones y *path traversal* ya implementadas en la Fase 19A.
- **Payload Malformado:** El LLM podría alucinar un `path` numérico u objeto anidado. Mitigación: El `DecisionParser` debe rechazar tipos estrictamente.
