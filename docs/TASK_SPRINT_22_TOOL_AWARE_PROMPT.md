# TASK SPRINT 22: TOOL-AWARE PROMPT BUILDER

## 1. Objetivo
El objetivo principal de este sprint es hacer que el `PromptBuilder` sea plenamente consciente de las Skills/Tools disponibles en el ecosistema del framework. Al proveer instrucciones explícitas y bien documentadas en el *System Prompt*, buscamos:
- Reducir significativamente las alucinaciones de `actionType` por parte del LLM.
- Preparar la infraestructura orquestal para el futuro entorno de *multi-step loop*.
- Mantener estrictamente el comportamiento de ejecución *single-pass* (una respuesta/acción por turno).

## 2. Estado Actual y Diagnóstico
Actualmente, `PromptBuilder.ts` contiene un prompt genérico con reglas muy crudas sobre las herramientas. Aunque `DecisionParser`, `PolicyEngine` y `ToolRegistry` soportan orgánicamente `read_file` y fallan limpiamente ante inputs maliciosos (gracias a `ReadFileTool`), el LLM no cuenta con un manual claro de uso, restricciones, ni alternativas si no conoce la ruta de un archivo, lo que frecuentemente lo induce a inventar acciones o tratar de adivinar *paths*.

## 3. Acciones a Documentar
El LLM deberá conocer exclusivamente el siguiente catálogo base:
- `send_message`: Para responder al usuario en lenguaje natural o solicitarle aclaraciones.
- `none`: Para no tomar ninguna acción explícita.
- `read_file`: Para recuperar el contenido de un archivo específico del workspace.

## 4. Formato JSON Esperado
El prompt debe reforzar que la salida debe ser exclusivamente un JSON válido bajo el siguiente esquema:
```json
{
  "intent": "respond | unknown",
  "confidence": 0.0 - 1.0,
  "proposedAction": {
    "type": "send_message | none | read_file",
    "payload": {}
  },
  "reasoning": "Breve justificación de la decisión tomada"
}
```

## 5. Documentación Específica de `read_file`
Para evitar rechazos del `PolicyEngine` o fallos en el *filesystem*, el prompt debe incluir las siguientes restricciones al documentar `read_file`:
- **Uso:** Solo cuando necesite leer el contenido de un archivo específico.
- **Payload:** `{ "path": "relative/path.ts" }`
- **Regla 1:** Prohibido usar rutas absolutas (e.g. `/home/user/...`).
- **Regla 2:** Prohibido usar secuencias de *path traversal* (`..`).
- **Regla 3:** Prohibido intentar acceder a directorios o archivos secretos (`.env`, llaves, certificados).
- **Fallback Crítico:** Si el LLM no sabe la ruta exacta, **DEBE** usar `send_message` pidiendo al usuario el path o indicando que se debe esperar a una futura *List/Search tool*.

## 6. Relación con el Flujo (Flow)
Este cambio inyecta consciencia en el cerebro del agente, lo cual es el pre-requisito funcional para el *multi-step*. Sin embargo:
- El framework se mantiene en ejecución de un solo paso (`single-pass`).
- No se añadirá ningún bucle de iteración o reintento (`loop`) en `AgentKernel.run`.

## 7. Diseño Recomendado
**Recomendación MVP (Menor Riesgo):** Hardcodear un bloque de texto bien formateado ("Tool Catalog") directamente dentro del string generado por `PromptBuilder.ts`.
*Alternativa futura:* Crear un componente `ToolPromptDescriptor` que extraiga la propiedad `.description` de la interfaz `Tool` y ensamble el catálogo dinámicamente. Para este sprint, el MVP anclado minimiza la sobre-ingeniería antes de refactorizar el registro.

## 8. Tests Propuestos
Actualizar o añadir tests en `tests/core/context/PromptBuilder.test.ts` para verificar que:
- El prompt construido incluye la mención a `send_message` y `read_file`.
- Se incluye la definición exacta del esquema JSON (`intent`, `confidence`, `proposedAction`, `reasoning`).
- Se listan explícitamente las restricciones del `path` (absolutas, `..`, secretos).
- **Ausencia:** El prompt *no* debe mencionar herramientas inexistentes como `write_file` o `execute_shell`.
- La suite global de pruebas pase sin regresiones (`npm test`).

## 9. Fuera de Alcance Explícito
En este Sprint **NO** se debe:
- Implementar ejecución *multi-step* ni bucles de *retries*.
- Implementar auto-corrección tras un fallo (ej. fallar `read_file` y volver a intentar automáticamente).
- Agregar nuevas herramientas (e.g. `ListFilesTool`, `WriteFileTool`).
- Modificar el comportamiento de `PolicyEngine` o `DecisionParser`.

## 10. Riesgos Técnicos
- **Extensión del Prompt:** Sobrecargar la ventana de contexto (*token limit*) si las reglas de la herramienta se vuelven demasiado verbosas.
- **Ambigüedad:** Instrucciones contradictorias entre el rol del sistema ("eres un programador") y las restricciones restrictivas del path.
- **Alucinación de herramientas futuras:** Si las instrucciones dicen "esperar a una futura search tool", el LLM podría alucinar un `search_files` en su lugar.
- **Acoplamiento de Strings:** Mantener las reglas y restricciones *hardcodeadas* en el string del `PromptBuilder` significa que si cambia la implementación en `ReadFileTool.ts`, el prompt quedará desincronizado.
