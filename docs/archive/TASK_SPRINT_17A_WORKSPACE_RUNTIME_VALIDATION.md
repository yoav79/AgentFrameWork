# Planificación Sprint 17A: Validación y Runtime de Workspaces

## 1. Objetivo
- Unificar la validación de nombres de `workspace`/`project` en una única fuente de verdad.
- Asegurar que `--project` rechace inmediatamente cualquier intento de *path traversal*.
- Asegurar que el comando REPL `/use` rechace inputs inválidos de *path traversal*.
- Asegurar que el flag `--persist` acople correctamente la escritura de eventos al log del proyecto actual (incluso si se cambia dinámicamente en el REPL).
- Preparar una frontera segura para el sistema antes de implementar Tools interactivas con el sistema de archivos (como `ReadFileTool`).

## 2. Estado Actual
- **Validación Actual:** `ProjectDirectoryAdapter` tiene el método `validateProjectName(name)`, pero es `private` y solo se aplica cuando se hace `/create` o se llama a `projectExists`.
- **Parsing `--project`:** Se lee en `apps/cli/cli.ts` (`args[i+1]`) y se pasa a `AgentFactory.create` sin ninguna validación formal de seguridad.
- **Comando `/use`:** En `apps/cli/CommandHandler.ts`, el comando `/use <target>` cambia la variable local `currentWorkspace` y actualiza `parsedArgs.projectId`, pero *no* reconstruye el `AgentKernel`.
- **`AgentFactory`:** Inyecta `projectId` al `EventLogFactory.create()`. El `AgentKernel` resultante queda atado a la instancia de `EventLog` creada en ese momento.
- **`EventLogFactory`:** Si se provee `projectId`, realiza una *sanitización silenciosa* (`sanitize(input)` que reemplaza caracteres inválidos con `_`) en lugar de rechazar el *path traversal*.
- **Desincronización de `/use`:** Como `/use` no reconstruye el `AgentKernel`, si el usuario arranca con `--persist` en modo global y luego hace `/use demo`, el agente seguirá escribiendo en el log global. Si arranca en `--project a` y hace `/use b`, los eventos se guardarán en el log del proyecto `a`.

## 3. Decisiones a Tomar
- **`WorkspaceNameValidator`:** Sí, se debe extraer o exponer la validación `validateProjectName` del `ProjectDirectoryAdapter` hacia una utilidad compartida o hacerla `public static` para usarla transversalmente.
- **Rechazo de Inputs:** Tanto `--project` (desde `cli.ts` o al parsear args) como `/use` deben rechazar estrictamente inputs inválidos con un `FrameworkError('VALIDATION_ERROR')`, abortando la inicialización o el cambio de contexto respectivamente.
- **Sanitización Silenciosa:** Se debe **eliminar** el método `sanitize` de `EventLogFactory`. El sistema debe operar en modo "fail-fast".
- **Reconstrucción de `AgentKernel` en `/use`:** `/use` debe reconstruir el `AgentKernel`. Al cambiar de workspace, el contexto y la memoria histórica pertenecen a otro entorno. Para evitar acoplamiento, `CommandHandler` debe recibir una *factory function* o instancia de factoría capaz de emitir un nuevo `AgentKernel` con el nuevo `projectId`.

## 4. Recomendación de Arquitectura
1. **Validación Centralizada:** Mover la lógica de validación de `ProjectDirectoryAdapter` a un nuevo archivo `core/utils/WorkspaceValidator.ts` (o similar), o exponerla como estática.
2. **Fail-Fast en CLI:** `cli.ts` debe usar el validador sobre `--project`. Si es inválido, lanzar error antes de inicializar nada.
3. **Fail-Fast en REPL:** `/use` debe validar el `target`. Si falla, mostrar error en rojo y mantener el workspace actual.
4. **Reconstrucción Dinámica:** Modificar el constructor de `CommandHandler` para que en lugar de (o además de) recibir una instancia fija de `AgentKernel`, reciba una función `createAgent(projectId?: string): AgentKernel` (cerrando sobre el flag de persistencia y el `LLMAdapter`). Cuando el usuario hace `/use` o `/close`, se llama a esta función para reemplazar `this.agentKernel`. Esto garantiza que tanto `InMemoryEventLog` como `FileEventLog` se reinicien al contexto correcto.

## 5. Comportamiento Esperado
- `agentframework --project demo` funciona y arranca el entorno demo.
- `agentframework --project ../evil` falla de inmediato con error de validación.
- REPL `/use demo` funciona, cambia el prompt, **y reinicia la memoria/log del agente para aislar el contexto**.
- REPL `/use ../evil` falla visualmente, manteniendo el contexto actual intacto.
- REPL `/create ../evil` sigue fallando visualmente.
- `--persist --project demo` escribe en `~/.agentframework/projects/demo/events.json`.
- Arrancar con `--persist` (global) y hacer `/use demo` comienza a persistir de forma segura en `projects/demo/events.json` (gracias a la reconstrucción de kernel).

## 6. Tests Propuestos
- **CLI One-off:** Rechaza explícitamente `--project ../evil` y finaliza con exit code 1.
- **REPL `/use`:** Comando interactivo rechaza entrada `../evil` y no cambia de contexto.
- **Reconstrucción `EventLog`:** Al inicializar un handler, llamar a `/use demo` comprueba que el `AgentKernel` instanciado escribe en el log de `demo` y no en el global anterior.
- **Configuración estricta:** Comprobar que `EventLogFactory` falla si se le inyecta un `projectId` inválido directamente, probando la eliminación de la sanitización silenciosa.
- La suite global de ~128 tests debe seguir pasando sin regresiones.

## 7. Fuera de Alcance
- No implementar `ReadFileTool` ni ninguna funcionalidad de Tools.
- No agregar lectura/escritura arbitraria de *File I/O*.
- No hacer comandos de shell.
- No realizar refactors del flujo interno del LLM (DecisionParser, PolicyEngine, etc.).
- No agregar dependencias externas.

## 8. Riesgos
- **Pérdida de memoria intencionada:** Al cambiar de workspace con `/use`, el `AgentKernel` se recrea y el contexto efímero se pierde. Esto es correcto arquitectónicamente (cada proyecto tiene su historial), pero puede sorprender a un usuario que espera que la misma "conversación" persista entre proyectos. Se compensará informando visualmente que el entorno ha cambiado.
- **Refactor de CommandHandler:** Requerirá que `cli.ts` le inyecte una fábrica. Esto cambiará la firma del constructor de `CommandHandler`, por lo que habrá que ajustar sus propios tests en `tests/cli/CommandHandler.test.ts`.
