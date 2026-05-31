# Backlog: Planificación Basada en Planes y Gestión de Artefactos

Este documento describe la arquitectura propuesta y las tareas necesarias para implementar un sistema de **Planificación Basada en Planes (Work Plans)** y gestión de **Artefactos Vivos** en el framework para el soporte de tareas complejas y multi-paso.

---

## 🎯 Objetivo General
Permitir que el agente aborde tareas de ingeniería de software de alta complejidad sin sufrir de deriva de objetivos, loops de ejecución, o amnesia del plan a largo plazo.

---

## 🏛️ Conceptos Clave

### 1. El Artefacto `plan.md` (o `.agent/plan.json`)
Un archivo persistente en el espacio de trabajo que describe las tareas y subtareas del agente. 
- **Estructura típica**:
  - Estado del objetivo principal.
  - Lista de subtareas en formato Markdown (`- [ ] Tarea`).
  - Notas de contexto/descubrimientos importantes.
- El agente lee este archivo al inicio de su ejecución (cargándolo en la **Working Memory**) y lo actualiza conforme realiza progresos.

### 2. Ciclo de Ejecución de Planificación (Plan-Act-Review Loop)
1. **Plan (Planificación)**: El agente analiza la solicitud del usuario y genera un `plan.md` si el alcance requiere más de 5 pasos o múltiples componentes.
2. **Act (Ejecución)**: El agente toma la primera tarea pendiente de su plan y la ejecuta usando las herramientas disponibles.
3. **Review (Revisión y Actualización)**: El agente actualiza `plan.md` marcando la tarea como completada, registrando cualquier nuevo descubrimiento, y seleccionando la siguiente tarea.

---

## 📋 Tareas de Desarrollo (Backlog)

### Fase 1: Extensión de Herramientas (Tools de Archivos / Artefactos)
- [ ] **Crear `WriteFileTool` y `UpdateFileTool`**: Permitir al agente escribir y modificar archivos específicos del proyecto de forma controlada (necesario para crear y tachar tareas en `plan.md`).
- [ ] **Asegurar validaciones de seguridad**: Validar que la edición de archivos esté restringida a los límites del workspace activo.

### Fase 2: Reglas de Sistema y Prompting
- [ ] **Actualizar el Prompt de Sistema (`PromptBuilder`)**:
  - Inyectar una instrucción que fuerce la creación de un plan de trabajo preliminar en `plan.md` cuando la tarea sea clasificada como compleja.
  - Enseñar al agente a consultar el plan existente para determinar qué paso ejecutar a continuación.
- [ ] **Re-diseñar el flujo de memoria**: Integrar automáticamente el contenido de `plan.md` en la sección de memoria de trabajo (`WorkingMemory`) de forma prioritaria.

### Fase 3: Interfaz de Usuario y Observabilidad (CLI)
- [ ] **Detector de Planes en el CLI**: Hacer que el CLI detecte si existe un `plan.md` y renderice visualmente el progreso de las tareas (ej. una barra de progreso `[██░░░░░] 30%` o una lista con checks de colores).
- [ ] **Modo Interrupción**: Permitir al usuario pausar la ejecución del agente para editar directamente el `plan.md` y redirigir el enfoque del agente.

### Fase 4: Pruebas de Resiliencia (E2E)
- [ ] **Simulaciones de fallos**: Simular que un paso del plan falla (ej. un comando de test da error) y validar que el agente edite el plan para añadir una subtarea de depuración en lugar de rendirse.
- [ ] **Recuperación tras reinicio**: Validar que si el agente se detiene y se reinicia en el mismo workspace, lea el `plan.md` existente y retome el trabajo exactamente donde lo dejó.
