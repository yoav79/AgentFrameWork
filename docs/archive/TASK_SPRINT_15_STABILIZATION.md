# TASK SPRINT 15: STABILIZATION

## Objetivo del Sprint
- Hacer que el repositorio sea reproducible.
- Arreglar el build (`typecheck`).
- Arreglar el comando `npm test`.
- Alinear los `ErrorCodes` con los usos reales dentro del código.
- Sanitizar los nombres de workspace para evitar vulnerabilidades.
- Actualizar la documentación para que refleje el estado real del framework.

---

## Plan por Bloques

### Bloque 1 — Scripts reproducibles
- Actualizar `package.json` para que `npm test` ejecute `vitest run`.
- Agregar (o confirmar) el script `npm run typecheck` que ejecute `tsc --noEmit`.
- No realizar cambios en la lógica productiva durante esta fase, solo configuraciones.

### Bloque 2 — TypeScript
- Diagnosticar desalineación entre `"type": "commonjs"` en `package.json` y `"module": "nodenext"`, `"verbatimModuleSyntax": true` en `tsconfig.json`.
- Proponer una corrección mínima (posiblemente cambiar `"type": "module"` en `package.json` o ajustar `tsconfig.json`).
- Asegurar que los tipos de Node (`@types/node`) estén disponibles y correctamente configurados si se usan módulos como `process`, `fs`, `path`.
- Evitar un refactor masivo de la base de código.

### Bloque 3 — ErrorCodes
- Listar todos los códigos de error usados en el repositorio (ej. `VALIDATION_ERROR`, `INTERNAL_ERROR`, `REGISTRY_ERROR`).
- Compararlos con `core/errors/ErrorCodes.ts` (que actualmente tiene `LLM_GENERATION_FAILED`, `INVALID_RESPONSE`, `NOT_IMPLEMENTED`, `PROJECT_ERROR`, `INTERNAL_ERROR`).
- Agregar los códigos faltantes a `ErrorCodes.ts` o ajustar los usos en el código para que coincidan.
- Mantener la compatibilidad estricta con la firma de la clase `FrameworkError`.

### Bloque 4 — Sanitización de workspace
- Revisar el comando `/create` y la clase `ProjectDirectoryAdapter`.
- Actualmente `ProjectDirectoryAdapter` concatena el nombre crudo del proyecto sin validación, lo que permite _path traversal_ (ej. `../../evil`).
- Reutilizar o replicar un criterio seguro similar a `EventLogFactory.sanitize` (ej. `input.replace(/[^a-zA-Z0-9_-]/g, '_')`).
- Prevenir explícitamente el uso de `../`, rutas absolutas y caracteres peligrosos en la creación y verificación de proyectos.
- Agregar tests automatizados para validar que no se pueda escapar del directorio `projects/`.

### Bloque 5 — Documentación
- Actualizar el `README.md` para reflejar el estado funcional real del proyecto.
- Corregir referencias a configuración de entorno, en especial `.env`, `OPENAI_API_KEY`, `OPENAI_MODEL`.
- Documentar el "modo agent", la persistencia, la memoria real implementada (ej. `MemoryReader`, `EventLogFactory`) y sus límites actuales.
- Aclarar qué funcionalidades son parte del roadmap futuro frente a las ya implementadas.
- Actualizar `docs/CHECKPOINT_SPRINT.md` o `docs/MEMORIA_TECNICA.md` según aplique.

---

## Tests Mínimos
- `npm test` ejecuta la suite real de pruebas y todas pasan (154 tests aproximadamente).
- `npx vitest run` pasa de forma exitosa.
- `npx tsc --noEmit` pasa sin errores de tipado.
- Los tests relacionados con _error codes_ pasan y el compilador aprueba su uso estricto.
- Al ejecutar el comando `/create ../../evil`, el sistema no sale de la carpeta `projects/` (el nombre es sanitizado o la operación es rechazada).
- Los nombres de workspace maliciosos se rechazan o se convierten en nombres seguros.
- Los tests del CLI siguen pasando con normalidad.

---

## Fuera de Alcance
- **No** eliminar código legacy.
- **No** implementar `ReadFileSkill`.
- **No** refactorizar `AgentKernel`.
- **No** refactorizar `AgentDependencies`.
- **No** implementar nuevas skills.
- **No** implementar auto-corrección (_self-correction_).
- **No** implementar configuración de políticas (_policy config_).
- **No** implementar soporte de base de datos SQLite.
- **No** realizar cambios funcionales grandes en el _agent runtime_.

---

## Riesgos Técnicos
- Cambiar la configuración de `tsconfig.json` (ej. corregir los imports de tipos) o el sistema de módulos puede revelar errores en cascada que antes estaban ocultos.
- Cambiar el sistema de módulos (`commonjs` a `module`) puede afectar cómo se resuelven los imports en todo el repositorio.
- La sanitización en el workspace puede cambiar los nombres visibles de directorios existentes (si tuvieran caracteres especiales), rompiendo referencias.
- Actualizar la documentación exhaustivamente puede revelar inconsistencias o funcionalidades dejadas a medias.
- Estandarizar los _error codes_ puede romper tests que actualmente validan strings crudas específicas, requiriendo su actualización.
