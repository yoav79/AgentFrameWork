# Sprint 6: AgentKernel MVP (Ejecución de una Sola Pasada)

## Objetivo del Sprint
Crear el `AgentKernel`, el orquestador principal de la nueva arquitectura dirigida por eventos. 
Este componente agrupará todas las piezas aisladas creadas en los Sprints 1 a 5 (`EventLog`, `StateResolver`, `ContextBuilder`, `PromptBuilder`, `DecisionParser`, `ActionExecutor` y el `LLMAdapter`) en un flujo continuo y determinista.

Para este MVP, **no será un ciclo infinito**. Orquestará **una sola pasada** del flujo agéntico por cada entrada del usuario. Se desarrollará en una carpeta paralela (`core/agent/`) para garantizar que el `Kernel.ts` legacy y el CLI actual permanezcan intactos.

## Flujo MVP (Una Sola Pasada)
1. Recibir input de texto y metadatos opcionales.
2. Construir un evento `UserMessageReceived`.
3. Almacenar el evento en el `EventLog`.
4. Ejecutar `StateResolver` usando el `EventLog` completo.
5. Usar `ContextBuilder` para derivar el contexto del estado.
6. Ensamblar las instrucciones del LLM mediante `PromptBuilder`.
7. Llamar de forma asíncrona al `LLMAdapter` inyectado (usando un mock en las pruebas).
8. Parsear la respuesta estricta mediante `DecisionParser`.
9. Invocar al `ActionExecutor` con la decisión.
10. Devolver el resultado de la habilidad o el error en un envoltorio formal (`AgentRunResult`).

## Archivos a Crear
Se ha seleccionado la carpeta `core/agent/` para separar semánticamente el nuevo orquestador agéntico de la lógica procedural antigua (`core/kernel/`).

- `core/agent/AgentKernel.ts`
- `core/agent/index.ts` (Export de la interfaz y clase)
- `tests/core/agent/AgentKernel.test.ts`

## Archivos que NO se deben tocar
- `core/kernel/Kernel.ts`
- `apps/cli/CommandHandler.ts`
- `apps/cli/cli.ts`

## Contratos Propuestos

### Dependencias por Constructor
El `AgentKernel` debe seguir el principio de Inversión de Dependencias estricto para facilitar pruebas:

```typescript
export class AgentKernel {
  constructor(
    private readonly eventLog: EventLog,
    private readonly stateResolver: StateResolver,
    private readonly contextBuilder: ContextBuilder,
    private readonly promptBuilder: PromptBuilder,
    private readonly llmAdapter: LLMAdapter,
    private readonly decisionParser: DecisionParser,
    private readonly actionExecutor: ActionExecutor
  ) {}
  
  public async run(input: string, projectId?: string, sessionId?: string): Promise<AgentRunResult> { ... }
}
```

### Resultados de Ejecución (`AgentRunResult`)
Proponemos un envoltorio por encima del `SkillResult` crudo, ya que a nivel orquestador es útil devolver metadatos adicionales de la decisión y diagnóstico de eventos para *debugging*.

```typescript
export interface AgentRunResult {
  success: boolean;
  skillResult?: SkillResult;
  decision?: Decision;
  error?: string;
  // eventIdsGenerados: string[] (Futuro: tracking events)
}
```

## Pruebas Mínimas (`tests/core/agent/AgentKernel.test.ts`)
- `[ ]` Inyecta correctamente un evento en el log y verifica su persistencia temporal.
- `[ ]` Recorre todas las capas exitosamente: Estado -> Contexto -> Prompt -> LLM Mock -> Parser -> ActionExecutor.
- `[ ]` Retorna un `AgentRunResult` validando que la capa profunda de Skill retornó `success: true`.
- `[ ]` Falla limpia y controladamente (`success: false` sin romper la aplicación) si el mock del LLM devuelve JSON inválido.
- `[ ]` Ataja los errores de negocio que emanan del `ActionExecutor` (ej: Fallos internos de una Skill).
- `[ ]` **Garantiza la ausencia** de dependencias de NodeJS, CLI interactivo o llamadas a OpenAI mediante aserciones a los mocks.

## Fuera de Alcance Explícito
- No se reemplazará el `Kernel.ts` legacy todavía.
- No se conectará el CLI interactivo al nuevo Kernel.
- No se programará un bucle agéntico asíncrono infinito (Ej: While Not Terminated), eso es posterior.
- No se programarán reintentos contra el LLM en caso de fallos en el `DecisionParser` (Solo se falla limpio).
- No se emitirán eventos de tipo "Resultado Emitido" o "Decisión Tomada" hacia el `EventLog`. Queda postpuesto como decisión arquitectónica futura.
- No se agregarán herramientas como `PolicyEngine` o dependencias de persistencia física en disco.

## Riesgos Técnicos Identificados
- **Acoplamiento Excesivo en el Constructor:** Tener 7 dependencias en el constructor podría ser molesto al instanciar el `AgentKernel` en producción. En el futuro podría evaluarse un patrón Factory o un contenedor de Inyección de Dependencias.
- **Tests Frágiles:** Al simular toda la cadena, si el Mock de LLMAdapter cambia, las pruebas podrían romperse abruptamente.
- **Manejo de Errores de Parseo:** Como no hay reintentos en el MVP, un JSON marginalmente corrupto del LLM matará silenciosamente el turno del usuario.
- **Opacidad del EventLog:** Al no inyectar todavía eventos con los resultados del `ActionExecutor`, el log solo reflejará "lo que se dijo", no "lo que se hizo", rompiendo parcialmente la promesa completa del *Event Sourcing* para la máquina de estados. Esto es deuda técnica planificada.

## Siguiente Paso Recomendado
Hacer commit de la planificación en `docs/TASK_SPRINT_6_AGENT_KERNEL.md` para sellar la hoja de ruta, y posteriormente saltar a la **Implementación Controlada** del `AgentKernel`.
