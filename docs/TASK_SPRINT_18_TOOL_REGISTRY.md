# Planificación Sprint 18: Infraestructura de Tool Registry

## 1. Objetivo
- Crear la arquitectura y capa mínima para manejar **Tools**.
- Diferenciar claramente y por diseño los conceptos de *Tools* y *Skills*.
- Dejar preparada la infraestructura para poder alojar herramientas reales (como `ReadFileTool`) en el futuro.
- **Importante:** No abrir acceso al File System (File I/O) ni implementar ninguna *Tool* concreta en este sprint.

## 2. Diferencia Conceptual (Skill vs Tool)
- **Skill:** Es un comportamiento compuesto, de alto nivel, que puede encadenar múltiples pasos cognitivos o lógicos (ej. "Enviar un mensaje al usuario", "Refactorizar módulo", "Buscar dependencias complejas").
- **Tool:** Es una operación **atómica y determinista** sobre el entorno o el sistema (ej. `ReadFile`, `WriteFile`, `ExecuteCommand`). Las herramientas son los bloques de construcción que usan las *Skills*. `ReadFile` debe nacer estrictamente como una Tool, no como un Skill.

## 3. Estado Actual
- Actualmente, `SkillRegistry` hace todo el trabajo de registro y ejecución de acciones.
- Existe la habilidad `SendMessageSkill` que funciona correctamente.
- El directorio `core/tools/` existe únicamente como *scaffolding* o *placeholder* (todos sus archivos están vacíos / 0 bytes).
- No existe un `ToolRegistry` real ni una separación operativa de herramientas.

## 4. Contratos Propuestos
Para asentar las bases de forma modular, se definirán los siguientes contratos (interfaces/clases):
- `Tool` (Interfaz)
- `ToolResult` (Interfaz)
- `ToolRegistry` (Clase)

## 5. Ubicación Propuesta
- Contratos y lógica central:
  - `core/tools/Tool.ts`
  - `core/tools/ToolResult.ts`
  - `core/tools/ToolRegistry.ts`
  - `core/tools/index.ts`
- Pruebas unitarias:
  - `tests/core/tools/ToolRegistry.test.ts`

## 6. API Mínima (Interfaces)
```typescript
export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

export interface Tool {
  readonly name: string;
  readonly description: string;
  canHandle(actionType: string): boolean;
  execute(input: unknown): Promise<ToolResult> | ToolResult;
}

// ToolRegistry
public register(tool: Tool): void;
public getToolForAction(actionType: string): Tool | undefined;
```

## 7. Relación con `ActionExecutor`
**Decisión y Recomendación:** Integración Condicional (Menor Riesgo).
En lugar de mantener el `ToolRegistry` totalmente desconectado como un silo, se recomienda inyectar `ToolRegistry` en el `ActionExecutor` junto con el `SkillRegistry`. 
La lógica recomendada en `ActionExecutor.execute` será de caída (*fallback*):
1. Intentar buscar en `SkillRegistry`.
2. Si no se encuentra un *Skill*, intentar buscar en `ToolRegistry`.
3. Si no existe en ninguno, devolver fallo.
Esta es la opción de **menor riesgo** ya que no rompe el flujo actual de `SendMessageSkill` y prepara el terreno automáticamente para las Tools.

## 8. Relación con `PolicyEngine`
- **No se agregarán nuevas reglas en este sprint.**
- *Documentado para el futuro:* Las Tools tendrán requerimientos de políticas mucho más estrictos que las Skills (ej. requerirán validación del path actual, permisos explícitos de lectura/escritura).
- No se aceptará ni validará una acción `read_file` todavía.

## 9. Relación con `DecisionParser` y `Decision`
- **No se modificará `DecisionParser`.**
- **No se ampliará `proposedAction.type`** en este sprint.
- *Documentado para el futuro (Sprint 19):* Una vez que exista la `ReadFileTool`, se extenderá el parser y el schema para reconocer `read_file` como un tipo de acción válido emitido por el LLM.

## 10. Tests Mínimos Requeridos
Se empleará TDD para la creación del registro:
- Permitir registrar una *Tool* válida.
- Lanzar error al intentar registrar duplicados por nombre.
- Encontrar y devolver una *Tool* por su `actionType`.
- Devolver `undefined` si no existe la herramienta solicitada.
- Asegurar que la herramienta no se ejecute accidentalmente durante el proceso de *lookup*.
- Garantizar que la interfaz acepta tanto firmas síncronas como asíncronas (`Promise<ToolResult> | ToolResult`).
- La suite global de tests (`npm test`) debe seguir pasando íntegramente (100% en verde).

## 11. Fuera de Alcance Estricto
- NO implementar `ReadFileTool`.
- NO implementar `WriteFileTool`.
- NO agregar acceso a File I/O ni módulos `fs`.
- NO implementar ejecución de comandos shell (`ExecuteCommand`).
- NO agregar búsquedas recursivas ni glob patterns.
- NO modificar `PolicyEngine`.
- NO modificar `DecisionParser`.
- NO implementar *self-correction* ni reintentos automáticos.
- NO incorporar *embeddings* o RAG.
- NO implementar el protocolo MCP ni A2A.

## 12. Riesgos Técnicos
- **Duplicidad semántica:** `ToolRegistry` y `SkillRegistry` tendrán una implementación casi idéntica bajo el capó. Esto puede sentirse como repetición (WET), pero es necesario para la separación conceptual y la posterior aplicación de políticas diferenciadas.
- **Sobre-arquitectura prematura:** Diseñar interfaces demasiado abstractas para las *Tools* antes de tener la primera. Mitigación: Mantener `execute(input: unknown)` simple.
- **Complicar el `ActionExecutor`:** Inyectar múltiples registros puede volver al ejecutor un embudo monolítico.
- **Romper `SendMessageSkill`:** Al modificar el `ActionExecutor` para soportar *Tools*, existe un riesgo mínimo de alterar la precedencia y romper el flujo funcional de la única *Skill* viva.
- **Inconsistencia de APIs Públicas:** Mezclar conceptualmente la salida de `SkillResult` con `ToolResult`, dificultando el manejo por parte del `AgentKernel`.
