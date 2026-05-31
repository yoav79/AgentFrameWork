# Planificación Sprint 19: ReadFileTool

## 1. Objetivo
- Implementar la primera herramienta atómica real: `ReadFileTool`.
- Permitir al Agente la lectura segura de archivos explícitos dentro de su entorno.
- Limitar estrictamente la lectura al *workspace/proyecto* actualmente permitido.
- Bloquear proactivamente el acceso a secretos, binarios y archivos peligrosos o de sistema.
- Integrar la acción `read_file` orgánicamente al flujo agéntico (Decision, Parser, Policy).

## 2. Contrato Propuesto
- **Action Type:** `read_file`
- **Payload Esperado:**
  ```json
  { "path": "relative/path/to/file.ts" }
  ```
- **Resultado Exitoso:**
  ```json
  {
    "success": true,
    "message": "File read successfully",
    "data": {
      "path": "relative/path/to/file.ts",
      "content": "...",
      "size": 1024
    }
  }
  ```
- **Resultado Fallido:** `ToolResult` con `success: false` y el `error` explicando el motivo (ej. Path Traversal, Tamaño Excedido, No Encontrado).

## 3. Root Permitido (Decisión Recomendada)
- **Problema:** El CLI y el Agente no siempre comparten el mismo punto de vista del File System de manera estática.
- **Opción recomendada para el MVP:** **Opción Inyectada por `AgentFactory`**. Al instanciar el agente, el CLI o entorno embebedor pasará la ruta base absoluta del workspace actual (e.g. `path.join(os.homedir(), '.agentframework', 'projects', projectId)` o `process.cwd()` según el caso). La Tool **jamás** debe intentar calcular su propio root. Solo recibirá un `baseDir` estricto en su constructor.

## 4. Reglas de Seguridad de Path (Jail)
Toda solicitud de lectura pasará por un filtro antes de tocar `fs`:
- Bloquear explícitamente rutas que comiencen con `/` (rutas absolutas).
- Bloquear explícitamente cualquier fragmento `..` (secuencias de Path Traversal).
- Resolver el path: `const finalPath = path.resolve(baseDir, requestedPath)`.
- **Sanity Check:** Verificar que `finalPath.startsWith(baseDir)` sea estrictamente verdadero.
- Usar `fs.statSync` para confirmar que el destino es un **archivo** (rechazar directorios).
- No seguir *symlinks* que escapen del `baseDir`.

## 5. Archivos Bloqueados (Lista Negra)
El agente tendrá denegado el acceso, independientemente del root, a:
- `.env`, `.env.*`
- `.pem`, `.key`, `.crt`, `.p12`
- `.sqlite`, `.db`
- `node_modules/`
- `.git/`
- Archivos ocultos sensibles a nivel sistema.

## 6. Límites Físicos
- **Tamaño Máximo:** 100 KB.
- **Comportamiento ante exceso:** Se recomienda **Rechazo estricto** en este MVP. Truncar archivos podría dar un contexto falso o roto al LLM. Si excede 100 KB, devuelve `success: false`.
- **Formato:** Exclusivamente textual con encoding `UTF-8`. Archivos binarios serán rechazados usando inspección básica o heurística (extensión o carácteres no imprimibles).

## 7. Integración con Contratos Existentes
- **`Decision` & `DecisionParser`:** Se ampliará el esquema para aceptar `read_file` como `proposedAction.type` válido.
- **`PolicyEngine`:** Se agregará una regla específica: `read_file` solo se permitirá si el `confidence` del LLM supera un umbral alto (e.g., > 0.8).
- **`AgentFactory`:** Se inyectará `new ReadFileTool(workspaceBaseDir)` dentro del `ToolRegistry` que hasta ahora estaba vacío.
- **`ActionExecutor`:** No requiere modificaciones lógicas (ya soporta Tools).

## 8. Auditoría y EventLog
- **Captura actual:** `ActionExecutor` ya retorna resultados, los cuales son interceptados por `AgentKernel` para emitir `ActionExecuted`.
- **Recomendación crítica:** **NO GUARDAR EL CONTENIDO** del archivo en el `EventLog`. El contenido puede inflar masivamente el JSON histórico de eventos, corrompiendo la memoria a largo plazo, e inadvertidamente hacer fugas de fragmentos sensibles.
- **Propuesta:** La metadata (path, size, success) debe loguearse, pero el campo `content` debe ser redactado u omitido antes de enviar al Log.

## 9. Tests Mínimos Propuestos
**ToolRegistry y ReadFileTool (`tests/core/tools/ReadFileTool.test.ts`):**
- Lee archivo válido y retorna el contenido exacto.
- Falla y bloquea si el path intenta hacer `../../secret.txt`.
- Falla y bloquea si el path es absoluto `/etc/passwd`.
- Falla y bloquea intentos contra `.env` o `node_modules`.
- Falla al intentar leer archivos > 100KB (usando mocks o archivos grandes generados al vuelo).
- Falla si el *target* es un directorio en lugar de un archivo.
**Integración:**
- `DecisionParser` parsea un JSON con acción `read_file` exitosamente.
- `PolicyEngine` deniega `read_file` con `confidence` bajo.
- La suite global (`npm test`) se mantiene en verde impecable.

## 10. Fuera de Alcance Estricto
- NO implementar escritura, borrado o modificación de archivos (`WriteFileTool`).
- NO ejecutar comandos Shell.
- NO incorporar lectura recursiva, búsqueda (grep local) ni patrones glob.
- NO listar directorios (`ls`).
- NO implementar *self-correction* (si la tool falla, el error va al contexto del turno, pero no se programa un reintento automático imperativo).
- NO involucrar MCP o A2A.

## 11. Riesgos Técnicos
- **Fuga de Secretos (Exfiltración):** Aún con bloqueos explícitos de `.env`, el usuario podría tener archivos con credenciales bajo otro nombre.
- **Path Traversal & Symlink Escape:** Resolver rutas siempre acarrea riesgos de seguridad en Node.js si no se usa `realpath` o prefijos correctos.
- **Prompt Injection desde archivos:** Si el contenido del archivo leído incluye instrucciones hostiles encubiertas, el LLM podría cambiar su comportamiento maliciosamente al leerlo en el siguiente turno de contexto.
- **Errores de Encoding:** Archivos con encodings raros (ej. UTF-16LE, BINARY) pueden crashear el parser del framework.
