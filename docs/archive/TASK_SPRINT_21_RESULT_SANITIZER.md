# TASK SPRINT 21: RESULT SANITIZER

## 1. Objetivo

El objetivo principal de este sprint es extraer la lógica de sanitización de resultados, actualmente anclada de manera imperativa en `AgentKernel`, hacia un componente dedicado, reutilizable y fácilmente testable (`ResultSanitizer`). 
Esto garantizará que:
- El `ExecutionTrace` jamás acumule *payloads* pesados en memoria (evitando OOM - Out Of Memory).
- Se eliminen las reglas hardcodeadas en `AgentKernel` que hoy solo contemplan `ReadFileTool`.
- El sistema quede preparado para el futuro bucle *multi-step* y para nuevas *Tools* que devuelvan información masiva en otros formatos.

## 2. Problema actual

En el Sprint 20B se introdujo la observabilidad pasiva (`ExecutionTrace`). Sin embargo, para evitar inflar la traza con el contenido crudo de los archivos, `AgentKernel` implementó la siguiente comprobación restrictiva:
```typescript
if (sanitizedData && typeof sanitizedData === 'object' && 'content' in sanitizedData) {
  const { content, ...rest } = sanitizedData as any;
  // ...
}
```
Esto presenta un problema de escalabilidad:
- Solo captura la llave `content` (específica de `ReadFileTool`).
- Si futuras herramientas (ej. descargas de red, ejecución de comandos) retornan campos como `base64Data`, `buffer`, o `stdout`, estos eludirán la regla y se fugarán a la memoria del trace.

## 3. Contrato Propuesto

Se propone crear un servicio puro sin estado en `core/flow/ResultSanitizer.ts`.

**API sugerida:**
```typescript
export class ResultSanitizer {
  /**
   * Sanitizes execution data for tracing purposes, filtering out heavy or 
   * raw payloads while preserving safe metadata. Does NOT mutate the original object.
   */
  public static sanitizeData(data: unknown): unknown {
    // ...
  }
}
```

## 4. Reglas Iniciales de Sanitización

El método deberá iterar las propiedades (si es un objeto) y aplicar las siguientes reglas mediante un enfoque de lista negra (*deny-list*) combinada con limpieza general:

**Remover por completo:**
- `content`, `raw`, `buffer`, `blob`, `base64`, `base64Data`

**Truncar (ej. primeros 500 caracteres) o remover:**
- `stdout`, `stderr`, `logs`, `entries` (cuando excedan un límite razonable).

**Conservar intacta metadata segura:**
- `path`, `size`, `mimeType`, `lineCount`, `truncated`, `summary`, `actionType`, `success`

## 5. Decisión sobre Profundidad

**Recomendación: MVP de Sanitización Superficial (Shallow)**
Para esta iteración, se recomienda iterar únicamente sobre el primer nivel del objeto (`shallow copy`). No implementaremos una recursión profunda (*deep clone/sanitize*) para evitar penalizaciones de CPU en *payloads* extremadamente complejos o circulares. 
Si en el futuro una Tool anida un buffer pesado en `data.metadata.file.buffer`, en ese momento se documentará e implementará un *sanitizer* recursivo. Por ahora, un *shallow sanitize* cubre el 99% de los casos de herramientas del Framework.

## 6. Integración Probable

- `AgentKernel` importará `ResultSanitizer` y reemplazará su lógica condicional hardcodeada por `const sanitizedData = ResultSanitizer.sanitizeData(actionResult.data);`.
- `ExecutionTrace` se mantiene agnóstico y puro (sigue recibiendo objetos, sin importarle su origen).
- El `EventLog` queda exento de modificaciones, puesto que ya delega al `ActionExecutedPayload` que actualmente no incluye la propiedad masiva `data`.
- El comportamiento público y los outputs originales devueltos al usuario por el agente permanecen inmutables.

## 7. Tests Propuestos

Se añadirán tests unitarios específicos bajo `tests/core/flow/ResultSanitizer.test.ts` para validar que:
- Elimina correctamente las llaves `content`, `base64Data`, `buffer` y `raw`.
- Conserva propiedades seguras como `path` y `size`.
- **NO muta** el objeto de entrada (comprobación estricta de referencias `!==` y preservación de llaves en el objeto original).
- Devuelve y maneja de manera segura valores primitivos (strings, números) o `undefined` y `null` como entrada.
- (Si aplica en el MVP) Trunca un string de `stdout` masivo.
- Adicionalmente, actualizar `AgentKernel.test.ts` para validar que sigue sin incluirse contenido gigante en el *trace* ahora que depende de este nuevo componente.

## 8. Fuera de alcance explícito

En este Sprint **NO** se debe:
- Implementar nuevas herramientas (`Tools`) como `ListFilesTool`.
- Implementar un bucle de ejecución *multi-step*.
- Implementar mecanismos de auto-reparación o reintentos.
- Realizar ningún tipo de modificación en el sistema de almacenamiento persistente (`EventLog`).
- Alterar la lógica de toma de decisiones o evaluación de permisos (`PolicyEngine`, `DecisionParser`).
- Introducir archivos externos de configuración.

## 9. Riesgos técnicos

- **Sanitizar demasiado (Data Loss):** Filtrar llaves legítimas y útiles para la depuración que por accidente compartan nombre con el *deny-list* (ej. una propiedad de metadato inocente llamada `content`).
- **Sanitizar muy poco (OOM):** Que un desarrollador introduzca una llave nueva como `fileBytes` en una tool, esquivando el `ResultSanitizer` y provocando un Out Of Memory.
- **Mutación accidental:** Modificar el objeto devuelto por la herramienta de manera que el llamador final (el usuario) pierda el `content` al solicitar la ejecución.
- **Complejidad prematura:** Construir un motor de recursión de objetos antes de que exista el problema real de llaves anidadas pesadas.
