# TASK SPRINT 24: MULTI-STEP EXECUTION LOOP

## 1. Objetivo
El objetivo primordial de este sprint es dotar al `AgentKernel` de un motor iterativo controlado (*Multi-Step Execution Loop*). Esto permitirá que el agente encadene acciones lógicas, como solicitar una lectura de archivo (`read_file`), inspeccionar efímeramente su contenido y, finalmente, emitir una respuesta fundamentada al usuario (`send_message`), todo dentro de una única invocación orquestal de `AgentKernel.run`, preservando la trazabilidad, los límites de seguridad y los contratos existentes.

## 2. Estado Actual
- **Runtime:** `AgentKernel.run` es un proceso estrictamente *single-pass*. 
- **Observabilidad:** `ExecutionTrace` recopila pasivamente los pasos, y `ResultSanitizer` evita el almacenamiento de payloads gigantes.
- **Cognición:** `PromptBuilder` está formalmente instruido con el catálogo de herramientas y restricciones. 
- **Modelo de Skills:** Se documentó (Sprint 23) la decisión de no crear *CompositeSkills* complejos todavía, apoyando la decisión de centralizar el bucle iterativo en el kernel.

## 3. Diseño Recomendado del Loop
Se implementará un bucle `while` o `for` estándar en `AgentKernel.run` que iterará hasta alcanzar el límite máximo de pasos.
**Por cada iteración (*step*):**
1. Construir estado y contexto. Si hubo un paso previo, inyectar el *ephemeral result* crudo.
2. Generar el *prompt* y consultar al `LLMAdapter`.
3. Parsear la `Decision`.
4. Evaluar con `PolicyEngine`.
5. Ejecutar vía `ActionExecutor`.
6. Sanitizar la respuesta y registrar el `AgentStep` y `StepResult` en el `ExecutionTrace`.
7. Evaluar las **Stop Conditions** para determinar si el bucle debe continuar o hacer *return*.

## 4. Decisión sobre `FlowConfig.maxSteps`
**Recomendación:** Modificar el `DEFAULT_FLOW_CONFIG.maxSteps` de `1` a `2`.
Dado que el framework ya dispone de un mecanismo anti-alucinaciones seguro, permitir `2` pasos como base (ej. `read_file` $\rightarrow$ `send_message`) habilitará la verdadera agencia básica del sistema sin abrir la puerta a bucles infinitos peligrosos. Si un desarrollador desea más pasos, podrá inyectar un `FlowConfig` sobreescrito.

## 5. Stop Conditions Obligatorias
El bucle debe romperse (`break` / `return`) inmediatamente si ocurre alguna de estas condiciones:
- **Término Natural:** `actionType === 'send_message'` (el agente interactúa con el usuario).
- **Abandono:** `actionType === 'none'` (el agente desiste o no encuentra acción útil).
- **Intervención de Seguridad:** `PolicyEngine` rechaza la decisión.
- **Fallo Físico:** `ActionExecutor` devuelve un error al ejecutar la herramienta.
- **Fallo Cognitivo:** `DecisionParser` o el `LLM` arrojan una excepción.
- **Límite de Seguridad:** Se alcanza la cantidad límite dictada por `FlowConfig.maxSteps`.

## 6. Reinyección de Resultados de Tools
Para que el LLM pueda razonar sobre lo que acaba de leer sin inflar permanentemente la base de datos o la memoria:
- El resultado en bruto (`raw content`) de herramientas como `read_file` se pasará **exclusivamente** al siguiente turno mediante una propiedad efímera.
- **No se persiste** este contenido crudo en el `EventLog`.
- **No se pasa** al `MemoryReader`.
- **No se guarda** en el `ExecutionTrace` (para eso usamos el `ResultSanitizer` del Sprint 21).

## 7. Cambios Probables en Contexto
1. **ContextBuilder:** Actualizar `BuiltContext` para admitir una propiedad opcional `ephemeralToolResult?: { actionType: string; data: unknown }`.
2. **PromptBuilder:** Modificar el renderizado para que, si `ephemeralToolResult` existe, inyecte una sección `[Previous Tool Result]` justo antes del `JSON Schema Expected`, de modo que el LLM disponga de los datos frescos para redactar su `send_message`.

## 8. Decisión sobre EventLog
- Se mantendrá intacta la emisión de los eventos existentes (`UserMessageReceived`, `ActionExecuted`, `ActionFailed`, `PolicyRejected`).
- El bucle emitirá un `ActionExecuted` (o `ActionFailed`) por **cada iteración/tool**, lo que es correcto para auditoría.
- Se mantendrá el diseño de no incluir el payload masivo en la propiedad del evento.
- **No se guardará el ExecutionTrace** dentro del EventLog.

## 9. Contrato Final de `AgentRunResult`
El retorno global de `AgentKernel.run` se definirá así:
- **Éxito (send_message / none):** Devuelve `success: true` con el resultado de dicha iteración terminal.
- **Policy Rejection:** Devuelve `success: false` y expone el `policyReason`.
- **Límite Alcanzado (maxSteps):** Si el agente ejecuta `read_file` y el *loop* se corta por alcanzar el máximo de pasos antes de emitir un `send_message`, el kernel devolverá el resultado del último paso (ej. `read_file`) como el `AgentRunResult` final.
- Siempre adjunta el `trace` completo de la ejecución con todos los pasos (sanitizados) ocurridos en el bucle.

## 10. Tests Propuestos
Actualizar y expandir `AgentKernel.test.ts`:
- Comprobar que el flujo directo (`send_message` único) devuelve 1 step (retrocompatibilidad).
- Mockear una secuencia de respuestas del LLM (`read_file` $\rightarrow$ `send_message`) y verificar que `AgentKernel.run` la orquesta en 2 steps dentro de la misma llamada.
- Validar que el resultado final es el `send_message` en una secuencia exitosa.
- Validar que el `trace` contiene ambos pasos pero que el `data.content` está sanitizado en ambos.
- Confirmar los cortes abruptos simulando `none`, `PolicyRejection`, fallo de herramienta y límite de `maxSteps`.

## 11. Fuera de Alcance Explícito
- No se implementarán reintentos automatizados (`retries`) ni auto-corrección (`self-correction`) ante fallos. Si la herramienta falla, el turno del agente falla.
- No se diseñarán nuevas Skills (ej. `CompositeSkill`, Expertos).
- No se incorporarán herramientas adicionales (`ListFilesTool`, `WriteFileTool`, `Shell`).
- No se introducirá interacción multi-agente (A2A).
- No se agregará funcionalidad de aprobación humana iterativa (Human-in-the-loop).

## 12. Riesgos Técnicos
- **Bucles Infinitos:** Un manejo deficiente de la condición `stepCount >= maxSteps` podría atrapar al hilo en un ciclo destructivo.
- **Consumo de Tokens Masivo:** Aunque el contenido de archivos es efímero en la base de datos, insertarlo en el *prompt* incrementa bruscamente el consumo de tokens en la API del LLM, arriesgando un desbordamiento del contexto límite del modelo.
- **Duplicidad de Audit Trails:** Podría generarse ruido o ambigüedad si el usuario confunde los múltiples eventos del `EventLog` generados en un solo turno.
