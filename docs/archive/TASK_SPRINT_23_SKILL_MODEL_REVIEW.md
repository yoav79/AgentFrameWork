# TASK SPRINT 23: SKILL MODEL REVIEW

## 1. Diagnóstico Actual

En la arquitectura presente del *Agent Framework*, las entidades `Skill` y `Tool` padecen de una difuminación conceptual.
- **Modelado de `Skill`:** Actualmente es una interfaz plana (`canHandle`, `execute`) que toma un objeto JSON y devuelve un `SkillResult`. Físicamente, se comporta como un simple *Action Handler* sincrónico.
- **Modelado de `Tool`:** Funcionalmente idéntico a `Skill`. Devuelve un `ToolResult` y se ejecuta de manera sincrónica y aislada (ej. `ReadFileTool`).
- **Rol del `ActionExecutor`:** Actúa como un enrutador plano. Si el `actionType` coincide con una *Skill*, la ejecuta; si no, busca en el `ToolRegistry`. No hay jerarquía ni delegación inteligente.
- **¿Por qué `Skill` parece una acción y no un experto?** Porque se ejecuta de una pasada (*single-pass*). No puede instanciar razonamiento, no retiene memoria de contexto, no itera y carece de un bucle de control interno para subdividir problemas complejos.

## 2. Diferencia Conceptual Recomendada

Para madurar el framework hacia flujos verdaderamente agenticos, debemos separar estos conceptos teóricamente:
- **Tool:** Operación atómica y sin estado sobre el entorno o infraestructura (ej. leer un archivo, ejecutar bash).
- **Simple Skill:** Acción lógica de alto nivel que el agente ejecuta directamente (ej. hablar al usuario, guardar en memoria).
- **Composite Skill (Experto):** Un comportamiento orquestado de nivel superior. Un "Experto" que encapsula su propio razonamiento, capaz de invocar múltiples herramientas a lo largo de varios pasos para resolver un problema de un dominio específico.
- **Flow:** El mecanismo de bucle iterativo que otorga a la capa superior o a un *Composite Skill* la capacidad de razonar paso a paso, reintentar y autocorregirse.

## 3. Ejemplos Prácticos

- **Simple Skill:** `SendMessageSkill` (Toma el texto y lo devuelve. Fin).
- **Composite Skills (Expertos):**
  - `MathExpertSkill`: Usa una tool de Python para calcular, valida el resultado iterativamente y devuelve la respuesta.
  - `HistoryExpertSkill`: Busca en una base de datos vectorial múltiple, sintetiza y redacta.
  - `CodeReviewSkill`: Lee el código, corre linters (tools), analiza los errores, pide corregir y aprueba.
  - `DebugErrorSkill`: Lee un stacktrace, inspecciona los archivos relevantes paso a paso, infiere la falla.

## 4. Limitación Actual
La limitación bloqueante en este momento es el flujo **single-pass**. 
Un experto real (como `CodeReviewSkill`) no puede cumplir su función en una sola decisión de ida y vuelta con el LLM. Necesita leer un archivo, evaluar el resultado, tal vez pedir ver otro archivo y, finalmente, emitir el veredicto. Sin un mecanismo de `Flow` (iteración), el experto está castrado.

## 5. Opciones Arquitectónicas

**Opción A (Centralizada):**
- Mantener las Skills como son actualmente (simples acciones).
- Implementar el bucle *Multi-Step* globalmente en el `AgentKernel`.
- El LLM principal (cerebro global) decide orgánicamente iterar paso a paso.

**Opción B (Sub-Agentes / Delegación):**
- Crear la entidad `CompositeSkill`.
- El `AgentKernel` delega una tarea compleja al `CompositeSkill`. Éste tiene su propio mini-bucle (mini `AgentKernel`) y su propio mini-LLM para iterar internamente hasta devolver un resultado final.

**Opción C (Orquestador Rígido):**
- Separar drásticamente `AgentSkill` de `ActionSkill`.
- `ActionExecutor` solo rutea herramientas atómicas.
- Se crea un `SkillOrchestrator` encargado puramente de instanciar expertos.

## 6. Recomendación para el MVP
**Se recomienda firmemente la Opción A.**
Para evitar la sobre-arquitectura prematura, el MVP debe consistir en incorporar primero el bucle iterativo controlado dentro del `AgentKernel` global. Se deben mantener las Skills actuales como acciones simples y documentar la visión teórica del `CompositeSkill` para cuando el LLM principal ya no escale y necesitemos delegar en sub-agentes (A2A).

## 7. Impacto en el Sprint 23
Dada la recomendación técnica, **el Sprint 23 NO debe intentar reprogramar el modelo de Skills**. 
El paso evolutivo obligatorio y bloqueante es dotar al orquestador principal de iteración. Por lo tanto, el Sprint 23 debe ser íntegramente enfocado en implementar el **Multi-Step Loop** en `AgentKernel`, aprovechando la observabilidad y sanitización (Sprints 20-22) que ya preparamos.

## 8. Fuera de Alcance Explícito
En las próximas iteraciones **NO** se debe:
- Implementar `MathExpertSkill`, `HistoryExpertSkill` o expertos análogos.
- Desarrollar la arquitectura de `CompositeSkill` (Sub-agentes).
- Diseñar comunicación Agente-a-Agente (A2A).
- Incorporar Tools destructivas o mutadoras (`WriteFile`, `Shell/CLI`).

## 9. Riesgos Técnicos
- **Sobrearquitectura:** Intentar construir jerarquías complejas de expertos (A2A) sin siquiera haber resuelto cómo iterar un bucle simple con un solo modelo.
- **Confusión Conceptual:** Seguir llamando "Skill" indiscriminadamente tanto a un `send_message` atómico como a un futuro experto matemático complejo.
- **Duplicidad de Razonamiento:** Si el agente principal itera para buscar un archivo, y delegamos la tarea a un `CompositeSkill` que también tiene que buscar ese archivo iterativamente, el sistema consumirá *tokens* astronómicos de forma redundante.
