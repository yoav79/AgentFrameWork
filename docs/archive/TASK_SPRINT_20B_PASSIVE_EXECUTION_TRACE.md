# TASK SPRINT 20B: PASSIVE EXECUTION TRACE INTEGRATION

## 1. Objetivo

El objetivo de este sprint es **integrar el `ExecutionTrace` de forma pasiva** dentro del método `AgentKernel.run`. La idea es capturar la información del ciclo de vida de la ejecución de una forma estructural sin alterar el comportamiento de la capa lógica.
Se debe:
- Capturar un solo `AgentStep` por ejecución (manteniendo el diseño *single-pass*).
- Devolver esta traza dentro del objeto `AgentRunResult`.
- Garantizar que **no** se implementen bucles (*multi-step*) ni se altere el flujo existente de toma de decisiones o eventos.

## 2. Estado actual

- Los contratos `ExecutionTrace`, `AgentStep`, `StepResult` y `FlowConfig` ya existen bajo `core/flow/`.
- Actualmente, el método `AgentKernel.run` procesa linealmente la entrada: `log -> state -> context -> llm -> parser -> policy -> executor -> log`.
- El `EventLog` funciona perfectamente como sistema de auditoría inmutable y persistente.
- Sin embargo, las entidades de Flow recién creadas son *código muerto* porque `AgentKernel` no instancia ni invoca a `ExecutionTrace`.

## 3. Diferencia entre EventLog y ExecutionTrace

Para evitar confusiones arquitectónicas:
- **`EventLog`**: Es el registro histórico, global y persistente (auditoría). Se utiliza para reconstruir el estado general del sistema o la memoria a largo plazo.
- **`ExecutionTrace`**: Es un rastro efímero (en memoria), puramente local a una llamada específica de `AgentKernel.run`. Modela un árbol/lista de pasos internos que toma el framework antes de devolver una respuesta al llamador. No debe almacenar información masiva y no reemplaza al `EventLog`.

## 4. Cambios probables

Para inyectar esto en el `run` sin romper nada, se proyectan los siguientes cambios:
1. **Modificar `AgentRunResult`**: Añadir el campo opcional `trace?: ExecutionTraceSnapshot` (o similar).
2. **Crear la Traza**: Al inicio de `AgentKernel.run`, instanciar `const trace = new ExecutionTrace();`.
3. **Paso del Agente (`AgentStep`)**: Justo después de que `DecisionParser` retorna una `Decision`, instanciar y añadir un `AgentStep` a la traza.
4. **Resultado del Paso (`StepResult`)**:
   - Si la política rechaza la acción, añadir un `StepResult` fallido.
   - Si `ActionExecutor` falla, añadir un `StepResult` fallido con el error.
   - Si `ActionExecutor` tiene éxito, añadir un `StepResult` exitoso.
5. **Captura de Errores Críticos**: Errores durante el `DecisionParser` o el `LLMAdapter` deben marcar el inicio/fin abrupto en la traza.

## 5. Decisión sobre serialización

**Recomendación: Snapshot plano (Serializable) y omisión de payload pesado.**
No se debe devolver la instancia cruda de la clase `ExecutionTrace` directamente en `AgentRunResult`. Es preferible devolver un *snapshot plano* (ej. `trace.getSteps()`, `trace.getResults()`). 
Además, se debe **filtrar exhaustivamente** la propiedad `data` del `ActionExecutor` (ej. `data.content` al usar `read_file`) para evitar duplicar el contenido masivo de archivos de disco en la memoria efímera de la traza de ejecución. La traza solo debe decir "se leyó el archivo X", no contener el archivo completo.

## 6. Manejo de Casos

El flujo inyectado debe cubrir:
- **Happy Path (`send_message` / `read_file`)**: `AgentStep` creado, `StepResult` exitoso con mensaje. `data` pesado debe ser filtrado.
- **Policy Rejected**: `AgentStep` creado, `StepResult` con `success: false` y el motivo por el cual falló en la capa Policy.
- **Parser Error / LLM Error**: `AgentStep` (si se pudo parsear) fallido, o un `StepResult` general de fallo por validación.
- **Action/Tool Failure**: `StepResult` con `success: false` reportando el error originado en el skill o la tool.
- **Action `none`**: `StepResult` exitoso sin operación.

## 7. Tests propuestos

Se añadirán tests en `tests/core/agent/AgentKernel.test.ts` que validen:
- `AgentKernel.run` devuelve la propiedad `trace` correctamente poblada.
- El `trace` contiene exactamente 1 step en los casos *happy path*.
- El `trace` marca `success: true` en caso de acción exitosa.
- El `trace` marca `success: false` si `PolicyEngine` bloquea.
- El `trace` **NO** contiene el contenido en crudo de los archivos (`data.content` está undefined o purgado).
- Validar que el comportamiento previo (ej. inyección correcta en el `EventLog`) sigue intacto y la suite global pasa.

## 8. Fuera de alcance explícito

- **NO** implementar bucle multi-step.
- **NO** implementar *retries* automáticos ni autorreparación (*self-correction*).
- **NO** alterar `ActionExecutor`, `PolicyEngine` ni `DecisionParser`.
- **NO** introducir configuración externa para Flow.
- **NO** modificar la CLI actual.
- **NO** añadir nuevas tools.

## 9. Riesgos técnicos

- **Romper el contrato público**: Que el tipado estricto modificado en `AgentRunResult` rompa módulos consumidores si no se hace opcional al principio.
- **Fuga de Memoria / Duplicación de I/O**: Filtrar los contenidos gigantes (ej. megabytes de un log file de `read_file`) en el `StepResult` de la traza, o terminar inyectando esa carga en JSON stringify accidental.
- **Pasos implícitos**: Inventar un paso "LLM" y un paso "Action". Se sugiere que el `AgentStep` agrupe todo el turno del agente (decisión + acción).
- **Dependencias circulares**: Provocar imports cruzados innecesarios entre `core/agent` y `core/flow`. Se resolverán importando solo tipos o interfaces limpias.
