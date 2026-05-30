# TASK SPRINT 20: FLOW SCOPE AND CONFIGURATION

## 1. Alcance real de `core/flow`

El módulo `core/flow` es el motor de ejecución secuencial e iterativa del agente. Es responsable de orquestar *cómo* se aplican las decisiones, manejar ciclos de vida de los pasos, gestionar reintentos, capturar trazas de ejecución y decidir cuándo el agente debe detenerse.

**Diferencias con otros módulos:**
- **Agent (`core/agent`)**: Es el orquestador principal de alto nivel. Une la memoria, el estado, el LLM y el flujo.
- **Routing (`core/routing`)**: Traduce la salida del LLM (string) a una decisión estructurada (`Decision`).
- **Policy (`core/policy`)**: Evalúa si una decisión estructurada está permitida antes de ser ejecutada, basándose en reglas estáticas o dinámicas de seguridad y negocio.
- **Context/Prompt (`core/context`)**: Prepara la información (estado, memoria) y formatea el prompt para el LLM.
- **Tools (`core/tools`)**: Proveen la capacidad funcional atómica (ej. leer un archivo). El flujo ejecuta estas tools, pero no define su lógica.
- **Flow (`core/flow`)**: Toma la decisión autorizada y coordina su ejecución a través de `ActionExecutor`. En el futuro, será responsable del bucle multi-step, controlando cuántas veces se itera y qué hacer si algo falla.

## 2. Diagnóstico actual

Actualmente, el sistema está diseñado estrictamente para un modelo *single-pass*:
- **`ActionExecutor`**: Se limita a recibir una acción y delegarla al `SkillRegistry` o `ToolRegistry`. Retorna un resultado atómico.
- **`AgentKernel`**: Orquesta el paso de mensaje de usuario a respuesta de LLM y ejecución de acción en un solo bloque lineal, sin iteraciones internas.
- **Faltan entidades clave**: No existe la noción de `AgentStep` (un turno en el bucle), `ExecutionTrace` (la historia de pasos del flujo), ni `FlowConfig` (reglas de ejecución).
- No hay soporte para multi-step loop, auto-corrección o reintentos dentro del mismo ciclo del agente.

## 3. Necesidad de configuración

**Por qué SÍ necesitamos configuración de flow interna:**
Para evolucionar de un modelo *single-pass* a uno *multi-step* controlado, el sistema necesita límites duros (guardrails). Sin configuración, un agente podría entrar en un bucle infinito de llamadas a tools fallidas. Necesitamos definir límites como el máximo de pasos, tolerancia a errores y políticas de reintento.

**Por qué NO conviene crear un archivo externo todavía:**
Crear un `flow.config.json` ahora mismo añade fricción de I/O, complejidad en el parseo y validación de esquemas antes de tener una necesidad real. Hasta que no haya múltiples *workspaces* dinámicos con requisitos dispares o políticas expuestas al usuario final, una configuración tipada en memoria (TypeScript) es más segura, rápida y refactorizable.

## 4. Contrato propuesto

Se propone crear interfaces internas en `core/flow`:

```typescript
// core/flow/FlowConfig.ts
export interface FlowConfig {
  maxSteps: number;
  maxToolCalls: number;
  stopOnPolicyRejection: boolean;
  stopOnToolError: boolean;
  allowRetries: boolean;
  maxRetries: number;
  stepTimeoutMs?: number;
}

// core/flow/AgentStep.ts
import { Decision } from '../schemas/Decision';
import { StepResult } from './StepResult';

export interface AgentStep {
  id: string;
  iteration: number;
  decision?: Decision;
  result?: StepResult;
  timestamp: Date;
}

// core/flow/StepResult.ts
export interface StepResult {
  success: boolean;
  actionType: string;
  output?: any;
  error?: string;
  durationMs: number;
}

// core/flow/ExecutionTrace.ts
import { AgentStep } from './AgentStep';

export interface ExecutionTrace {
  traceId: string;
  startTime: Date;
  endTime?: Date;
  status: 'running' | 'completed' | 'failed' | 'timeout';
  steps: AgentStep[];
}
```

## 5. Defaults recomendados

Se recomienda definir un `DEFAULT_FLOW_CONFIG` que preserve el comportamiento actual (single-pass) para evitar regresiones:

```typescript
export const DEFAULT_FLOW_CONFIG: FlowConfig {
  maxSteps: 1, // Single-pass por defecto inicialmente
  maxToolCalls: 1,
  stopOnPolicyRejection: true,
  stopOnToolError: true,
  allowRetries: false,
  maxRetries: 0
  // stepTimeoutMs: undefined
};
```

## 6. Decisión sobre archivo externo

- **NO crear `flow.config.json`** en esta fase.
- **NO crear `agentframework.config.json`** en esta fase.
- **Justificación**: Se documenta como deuda técnica planificada. Se introducirán configuraciones basadas en archivos físicos únicamente cuando surja la necesidad de permitir *overrides* específicos por entorno/workspace (ej. usuarios modificando sus workflows predefinidos sin recompilar código).

## 7. Cambios probables para implementación posterior

En el siguiente paso de desarrollo, se deberán realizar las siguientes acciones en el repositorio:
- Crear el archivo `core/flow/FlowConfig.ts` con sus tipos y constantes por defecto.
- Crear los archivos `core/flow/AgentStep.ts`, `core/flow/StepResult.ts` y `core/flow/ExecutionTrace.ts`.
- Actualizar `core/flow/index.ts` para exportar las nuevas interfaces.
- Añadir tests unitarios en `tests/flow/` que validen la instanciación de estos tipos y defaults.
- **Crucial**: NO cambiar todavía la lógica de `AgentKernel.run`. El objetivo inicial es solo sentar las bases tipadas del contrato del Flow.

## 8. Fuera de alcance explícito

En este sprint y documento, los siguientes elementos están **estrictamente fuera de alcance**:
- Implementar la lógica del bucle *multi-step* real en `AgentKernel`.
- Implementar mecanismos reales de reintento o auto-corrección (`self-correction`).
- Escribir o integrar nuevas `Tools` (ej. escritura de archivos o ejecución de shell).
- Implementar soporte para leer archivos de configuración desde el disco (`fs`).
- Modificar el sistema de inyección de estado en el `PromptBuilder`.
- Cambiar la evaluación de políticas en `PolicyEngine`.
- Modificar el parseo en `DecisionParser`.

## 9. Riesgos

- **Sobre-arquitectura**: Introducir demasiados niveles de abstracción (como traces anidados) prematuramente sin que el `AgentKernel` los aproveche.
- **Duplicar EventLog**: Confundir `ExecutionTrace` (efímero, específico de la corrida actual en el flow) con `EventLog` (persistente, auditoría global del sistema). Es vital documentar que el Trace es un agregador en memoria para el bucle del flow, mientras que EventLog es la fuente de la verdad inmutable.
- **Configuración sin uso**: Crear parámetros en `FlowConfig` que luego nadie respeta en la capa de ejecución (código muerto).
- **Romper comportamiento single-pass**: Si se inyecta inadvertidamente el flow config en etapas de ejecución y altera los timeouts o loops en `AgentKernel`, rompiendo tests actuales.
- **Confusión de alcances**: Mezclar `FlowConfig` (reintentos, iteraciones del agente) con la configuración global de runtime (claves de API, paths de workspace).
