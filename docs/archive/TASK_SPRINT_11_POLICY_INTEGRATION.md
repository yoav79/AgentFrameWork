# Sprint 11: Integración del PolicyEngine en AgentKernel

## Objetivo del Sprint
El propósito exclusivo de este sprint es engarzar el `PolicyEngine` (construido en aislamiento durante el Sprint 10) directamente en la médula espinal del modo agéntico: el `AgentKernel`. 
El motor actuará como un *Gatekeeper* estricto. Interceptará y auditará la `Decision` inmediatamente después de ser parseada por el `DecisionParser`, y dictaminará si tiene permiso para avanzar hacia la capa de mutación de estado y ejecución (`ActionExecutor`).

## Flujo de Ejecución Propuesto
El *Single-Pass Pipeline* mutará para acomodar la nueva compuerta de seguridad:
1. `AgentKernel` recibe el input del usuario.
2. Construye y hace persistente el evento `UserMessageReceived`.
3. El `StateResolver` computa el estado derivado en base al historial de eventos.
4. El `ContextBuilder` inyecta las *Skills* y estructura el contexto.
5. El `PromptBuilder` ensambla el System Prompt.
6. Se dispara la inferencia de red (`LLMAdapter`).
7. El `DecisionParser` extrae el objeto estructurado (`Decision`).
8. **[NUEVO]** El `PolicyEngine` evalúa crípticamente la `Decision`.
9. **[NUEVO - RECHAZO]** Si `allowed === false`: El flujo **aborta** la ejecución de Skills. Se retorna un `AgentRunResult` con `success: false` y se empaqueta la razón dictaminada (`policyReason`) hacia el front/CLI.
10. **[NUEVO - APROBADO]** Si `allowed === true`: El flujo fluye libremente y se invoca al `ActionExecutor` con la seguridad de que la acción superó el umbral.

## Cambios Arquitectónicos Probables
- `core/agent/AgentKernel.ts`: Ampliará su constructor (Dependency Injection) para recibir una instancia de `PolicyEngine`. Añadirá la compuerta lógica (pasos 8 y 9) dentro del método `.run()`.
- `core/agent/AgentFactory.ts`: Se convertirá en el responsable de instanciar `new PolicyEngine()` y proveerlo al `AgentKernel` durante su construcción.
- `core/schemas/AgentRunResult.ts` o la interfaz local: Asegurarse de que exista una forma semántica de devolver un error no fatal por política (ej. `{ success: false, policyReason: PolicyDecision.reason }`).
- Tests de `AgentKernel` y `AgentFactory` actualizados para inyectar y mockear el nuevo motor.

## Comportamiento Estricto ante el Rechazo
- **Cero Side-Effects:** Bajo ninguna circunstancia se debe ejecutar el `ActionExecutor`.
- **Graceful Degradation:** Retornar un `AgentRunResult` limpio con `{ success: false, decision, state, eventId, policyReason: reason }`.
- **No lanzar excepciones:** No dispararemos un `throw new Error()` crudo que rompa la terminal. Será un fracaso controlado.
- **Sin Segundas Oportunidades (Aún):** No habrá bucles `Retry`. Si la política dice "No", el Single-Pass aborta allí mismo.
- **Sin Persistencia (Aún):** No inyectaremos un evento de tipo `PolicyRejected` en el `EventLog` durante este sprint.

## Pruebas Mínimas Requeridas
- `[ ]` `AgentKernel` invoca al `ActionExecutor` si el mock del `PolicyEngine` emite un dictamen aprobatorio.
- `[ ]` `AgentKernel` detiene su curso (no invoca el `ActionExecutor`) si la política decreta rechazo.
- `[ ]` Un rechazo por "baja confianza" desemboca en un `AgentRunResult` fallido conteniendo la severidad y razón precisa.
- `[ ]` Un rechazo por "Acción Desconocida" desemboca en un resultado fallido idéntico sin mutar el entorno local.
- `[ ]` `AgentFactory` inyecta rigurosamente el `PolicyEngine` en el constructor del Kernel.
- `[ ]` La invocación al modelo real de OpenAI sigue desactivada en los *unit tests*.
- `[ ]` La suite del flujo Legacy (`Kernel.ts`) continúa pasando limpiamente.

## Fuera de Alcance Explícito
- Modificaciones estructurales al flujo conversacional del CLI.
- No se tocará `Kernel.ts` (el comportamiento legacy sigue inmutable).
- Eventos transaccionales: No se crearán esquemas para guardar el dictamen del Engine en memoria/disco.
- Bucle de Autocorrección: El LLM no recibirá *feedback* sobre su rechazo para que lo intente de nuevo.
- Reglas Dinámicas: Las políticas siguen siendo `Hardcoded`. No se leerán JSONS ni se mapearán Roles/Usuarios.
- No hay nuevas dependencias ni *Skills* adicionales.

## Riesgos Técnicos Identificados
- **Inflación del Constructor:** El `AgentKernel` suma otra dependencia más a su inyección. Si en el futuro suma más motores, el constructor requerirá un encapsulamiento (Ej. inyectar un único `AgentDependencies` Object).
- **Formatos Ambiguos de Error:** Diferenciar a nivel de cliente cuándo el `success: false` del `AgentRunResult` ocurrió por un fallo de red o un LLM roto, versus un rechazo voluntario de Política. Se necesitará auditar muy de cerca cómo consume estos retornos el CLI/Renderer.
- **Mock Hell:** Los tests del `AgentKernel` podrían volverse frágiles si empezamos a mockear pesadamente al `PolicyEngine` junto al `LLMAdapter` y al `ActionExecutor`.

## Siguiente Paso Recomendado
Realizar el commit de esta planificación en `docs/TASK_SPRINT_11_POLICY_INTEGRATION.md`. Posteriormente, comenzaremos la ejecución del sprint modificando el `AgentKernel` e inyectándole nuestra barrera de contención.
