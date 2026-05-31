# Sprint 3: ContextBuilder y Decisión Estructurada

## Objetivo del Sprint
Construir una capa intermedia determinista capaz de:
1. Tomar el `State` derivado del Sprint 2 y transformarlo en un contexto usable (`ContextBuilder`).
2. Definir un esquema formal estricto para forzar al LLM a emitir una decisión JSON predecible.
3. Parsear y validar esa decisión de vuelta al sistema (`DecisionParser`), garantizando inmunidad contra alucinaciones del modelo.

Todo esto mantendrá el aislamiento absoluto del sistema base sin emitir llamadas de red reales.

## Alcance Estricto
Implementar constructores de contexto puramente funcionales, contratos de esquema de decisión en TypeScript, y un validador/parser estricto que asegure que el JSON contenga una intención, una acción propuesta y un nivel de confianza válido. No se ejecutarán habilidades ni se conectará a APIs.

## Archivos a Crear
- `core/context/ContextBuilder.ts` (Generador del estado al formato de prompt LLM).
- `core/context/PromptBuilder.ts` (Opcional, puede integrarse a ContextBuilder).
- `core/schemas/Decision.ts` o `core/schemas/DecisionSchema.ts`.
- `core/routing/DecisionParser.ts`.
- `tests/core/context/ContextBuilder.test.ts`.
- `tests/core/routing/DecisionParser.test.ts`.

## Archivos que NO se deben tocar
- `core/kernel/Kernel.ts`
- `apps/cli/CommandHandler.ts`
- `apps/cli/cli.ts`
- `core/llm/*`
- `core/events/*`
- `core/state/*`

## Contratos Propuestos

### `Decision`
```typescript
export interface Decision {
  intent: 'respond' | 'unknown';
  confidence: number;
  proposedAction: {
    type: 'send_message' | 'none';
    payload?: Record<string, unknown>;
  };
  reasoning?: string;
}
```

### `DecisionParser`
```typescript
export class DecisionParser {
  public parse(rawResponse: string): Decision {
    // Validar JSON y estructura mínima estricta
  }
}
```

## Validación Mínima y Comportamiento Esperado (`DecisionParser`)
- **JSON Válido:** Asegurar que la entrada sea parseable (no texto plano).
- **Required:** Exigir `intent` y `proposedAction.type`.
- **Confidence Range:** Validar matemáticamente que `confidence` esté en el rango de `[0, 1]`.
- **Non-Execution:** El parser solo valida semánticamente, jamás ejecuta la acción propuesta.

## Tests Mínimos

### `ContextBuilder.test.ts`
- `[ ]` Genera contexto desde estado vacío.
- `[ ]` Incluye explícitamente último mensaje (`lastUserMessage`), `projectId`, `sessionId` y el `messageCount`.
- `[ ]` `PromptBuilder` (o generador) anexa instrucciones de sistema estrictas que exigen retorno en JSON.

### `DecisionParser.test.ts`
- `[ ]` Acepta JSON válido y bien formado.
- `[ ]` Rechaza JSON malformado o texto plano.
- `[ ]` Rechaza `confidence` menor a 0 o mayor a 1.
- `[ ]` Rechaza JSON que no incluya `proposedAction.type`.
- `[ ]` Asegura que no ocurre ninguna ejecución en memoria ni asíncrona.

## Fuera de Alcance Explícito
- No modificar el flujo interactivo (CLI).
- No modificar el orquestador legado (`Kernel.ts`).
- No crear todavía el `AgentKernel`.
- No llamar a la API real de OpenAI u otros adaptadores.
- No implementar `SkillRegistry` o `SendMessageSkill`.
- No implementar `ActionExecutor`.
- No implementar `PolicyEngine`.
- No persistir información en disco.
- No instalar bibliotecas externas como `zod` o `ajv` a menos que se justifique (el parser manual es suficiente para el MVP).

## Riesgos Técnicos
- **Diseño Prematuro de Intents:** Si limitamos `intent` a strings literales como `'respond' | 'unknown'` desde ahora, agregar nuevos intents en el futuro requerirá modificar el esquema central repetidamente.
- **Prompt Demasiado Rígido:** Obligar al LLM a devolver un JSON estricto sin ejemplos puede ocasionar altas tasas de falla en modelos menos capaces.
- **JSON Parsing Frágil:** LLMs frecuentemente envuelven respuestas JSON en bloques de código de markdown (` ```json `), lo que romperá `JSON.parse` si no se limpia previamente la entrada.
- **Falta de Schema Runtime:** Validar con ifs anidados es propenso a errores en comparación con validadores esquemáticos en tiempo de ejecución (como Zod).

## Siguiente Paso Recomendado
Realizar commit de este roadmap para versionarlo e iniciar la fase de ejecución construyendo `core/schemas/Decision.ts`, `DecisionParser` y `ContextBuilder`.
