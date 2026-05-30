# Sprint 9: Integración de Persistencia Opcional en CLI

## Objetivo del Sprint
En el Sprint 8 dotamos al núcleo con la capacidad de recordar mediante `FileEventLog`. El objetivo de este sprint es habilitar esta persistencia en la capa exterior (`CLI`) para que el usuario pueda optar por un historial de interacciones persistente entre sesiones.

Mantendremos el comportamiento volátil (`InMemoryEventLog`) como comportamiento por defecto para no comprometer el principio de inmutabilidad del sistema. Para utilizar el log en disco, exigiremos un opt-in explícito.

## Diseño de CLI y Activación
**Flag Recomendado:** `--persist`

**Comportamientos:**
- `cli sin flags`: Legacy (intacto).
- `--agent`: Agente con `InMemoryEventLog` (intacto).
- `--agent --persist`: Agente usando `FileEventLog`.
- `--persist` (sin `--agent`): Deberá ignorarse pero mostrar una **advertencia controlada** en consola (*Warning: --persist se ignora en el modo Legacy*).

## Ubicación del Archivo
Tras evaluar:
1. `~/.agentframework/events.json`
2. `~/.agentframework/projects/<projectId>/events.json`
3. `~/.agentframework/projects/<projectId>/sessions/<sessionId>/events.json`
4. `.agentframework/events.json` (Local)

**Recomendación MVP:** Aislar el historial en el directorio de usuario (Home / `~`) usando el `projectId` como segmentación.
- *Con `projectId`:* `~/.agentframework/projects/<safeProjectId>/events.json`
- *Sin `projectId`:* `~/.agentframework/global/events.json`

**Justificación:** Centralizarlo en el *Home Directory* (`os.homedir()`) evita ensuciar indiscriminadamente los repositorios locales de los usuarios (evitando `.gitignore` frustrantes). La jerarquía de `<safeProjectId>` separa inteligentemente los contextos sin requerir una base de datos compleja, proveyendo al mismo tiempo un *fallback global* ordenado.

## Estrategia de Sanitización (Crítico)
El campo `projectId` proviene del input del usuario. **No debe usarse crudo** para construir rutas físicas para evitar ataques de *Path Traversal* (Ej: `--project ../../../etc/`).
Se creará una función de sanitización que:
- Solo permita caracteres alfanuméricos, guiones y guiones bajos (`[a-zA-Z0-9_-]`).
- Todo otro carácter se reemplazará (o se eliminará).

## Archivos Probables
- `core/events/EventLogFactory.ts` (Nuevo componente para decidir entre Memoria y Archivo, e inyectar *Paths* limpios).
- `core/events/index.ts` (Export de la fábrica).
- `core/agent/AgentFactory.ts` (Recibirá las directrices de persistencia del CLI).
- `apps/cli/cli.ts` (Parseará el flag `--persist`).
- `apps/cli/CommandHandler.ts` (Ignorará el flag en el mensaje posicional).
- `apps/cli/Renderer.ts` (Mostrará la ayuda del flag).
- `tests/core/events/EventLogFactory.test.ts`.
- `tests/cli/` (Actualizaciones de CLI tests).

## Pruebas Mínimas Requeridas
- `[ ]` `EventLogFactory` devuelve memoria si no hay flag de persistencia.
- `[ ]` `EventLogFactory` devuelve `FileEventLog` con la persistencia encendida.
- `[ ]` El `projectId` se sanitiza antes de convertirse en una ruta.
- `[ ]` La ausencia de `projectId` apunta a una ruta global.
- `[ ]` El CLI levanta el modo `AgentKernel` con persistencia usando `--agent --persist`.
- `[ ]` El flag `--persist` no contamina el input posicional (el prompt del usuario).
- `[ ]` Los tests asertan usando inyección de un `basePath` temporal para no ensuciar la PC del desarrollador/usuario final.

## Fuera de Alcance Explícito
- No se migrará a SQLite ni base de datos.
- No se implementará el **PolicyEngine** ni memoria semántica.
- No se reemplazarán comportamientos legacy de `Kernel.ts`.
- No se resolverá el problema de concurrencia agresiva.
- No se implementará cifrado criptográfico todavía.
- No persistiremos separadamente el State, el Context ni las Skills (el paradigma de EventSourcing indica que el Log es la única fuente de verdad real).

## Riesgos Técnicos Identificados
- **Path Traversal / Rutas inseguras:** Deficiencias en el sanitizador expondrían el file system.
- **Concurrencia Multi-proceso:** Abrir múltiples terminales simultáneas con `--agent --persist` bajo el mismo proyecto sin un mecanismo de *lock/mutex* podría fragmentar el archivo JSON.
- **Confusión UX:** Los usuarios podrían creer que `--persist` activa la IA, cuando en realidad deben usar ambos (`--agent --persist`). 
- **Tests Frágiles:** Las pruebas dependientes del *Home Directory* fallarán en entornos CI mal configurados si no se usa `os.tmpdir()`.

## Siguiente Paso Recomendado
Sellar la planificación realizando el respectivo commit de `docs/TASK_SPRINT_9_PERSISTENCE_INTEGRATION.md`. Posteriormente, avanzaremos construyendo el `EventLogFactory` y engarzándolo a la capa `CLI` de forma segura.
