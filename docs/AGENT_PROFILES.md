# Agent Profiles

El sistema de **Agentes Pluggables** permite que múltiples personalidades, lógicas de negocio y perfiles de capacidades coexistan de manera segura y declarativa en **AgentFrameWork**.

## Qué es un AgentProfile
Un `AgentProfile` es un contrato declarativo, representado típicamente por un archivo `profile.json`, que define quién es el agente, qué instrucciones obedece y exactamente a qué herramientas (tools), plugins físicos y acciones base (skills) tiene acceso. En lugar de codificar agentes a mano, se definen perfiles que modifican cómo se instancian el `AgentFactory` y el `PromptBuilder`.

## Diferencia entre AgentProfile, Tool, Skill, Plugin y Multi-Agent
- **AgentProfile**: La configuración de la identidad y restricciones del agente.
- **Plugin**: El módulo físico (código TypeScript/JavaScript) que se carga en memoria (ej. `plugins/tools/ReadFileTool.js`).
- **Tool**: La herramienta funcional que expone el Plugin al agente (ej. capacidad de leer un archivo).
- **Skill**: Las habilidades base del sistema para el agente, como `send_message` (responder al usuario) o `none` (acciones internas).
- **Multi-Agent**: La capacidad (futura) de que varios agentes dialoguen entre sí en una misma sesión. Actualmente el framework soporta _un solo agente activo_ por sesión, pero fácilmente intercambiable.

## Convención de Carpetas
El framework utiliza una convención por defecto basada en el identificador (ID) del agente. Los perfiles deben colocarse en:
`agents/<agentId>/profile.json`

Por ejemplo, un agente de logística tendrá su archivo en `agents/logistics-demo/profile.json`.

## Uso desde CLI
Para arrancar el framework con un agente específico cargado desde disco, se utiliza la bandera `--agent`:

```bash
npm run dev -- --agent standup-demo "Cuéntame un chiste corto"
```

## Estructura de profile.json

### Campos Requeridos
- `id` (string): Identificador único del agente (debe coincidir preferiblemente con la carpeta).
- `name` (string): Nombre legible del agente.
- `description` (string): Descripción de propósito general.
- `persona.systemInstructions` (string): El prompt central que define quién es y qué hace el agente.

### Campos Opcionales
- `persona.tone` (string): Tono del agente (ej. "profesional", "humorístico").
- `persona.language` (string): Idioma preferido.
- `persona.responseStyle` (string): Formato de respuesta esperado (ej. "viñetas", "párrafos cortos").
- `goals` (string[]): Objetivos principales del agente.
- `rules` (string[]): Reglas inquebrantables de negocio.
- `enabledPlugins` (string[]): Nombres de los plugins físicos permitidos para cargar en memoria.
- `allowedTools` (string[]): Acciones lógicas (`actionType`) permitidas.
- `allowedSkills` (string[]): Acciones base permitidas (usualmente `["send_message", "none"]`).
- `examples` (array): Ejemplos *few-shot* para enrutar decisiones del LLM.
- `safety` (object): Restricciones adicionales y bloqueos.
- `metadata` (object): Metadatos adicionales opcionales.

## Semántica de Capabilities

El framework utiliza un sistema de **filtrado estructural de 3 capas**:
1. **`enabledPlugins`**: Filtra los plugins físicos a nivel de módulo (ej. `manifest.name`). Determina si el código se inicializa y se le asigna memoria, interactuando directamente con el allowlist global `agent.config.json`.
2. **`allowedTools`**: Filtra las capacidades lógicas (`manifest.actionType`). Permite registrar de forma granular solo ciertas acciones extraídas de los plugins que se hayan logrado cargar.
3. **`allowedSkills`**: Filtra los comportamientos innatos del loop (como `send_message` o `none`). Se purgan directamente de memoria en `ActionCatalog` si el agente no tiene permiso para usarlos.

## Reglas Importantes
- **Fuente de verdad global**: `agent.config.json` sigue mandando a nivel de workspace. Un perfil no puede activar un plugin que el usuario ha deshabilitado globalmente; si lo intenta, se lanza un Error Fatal.
- **Mantenimiento del fallback**:
  - `enabledPlugins: undefined` → Carga todo lo permitido por el workspace.
  - `allowedTools: undefined` → Permite usar todas las tools que logren cargar.
  - `allowedSkills: undefined` → Permite las base skills estándar (`send_message`, `none`).
- **Comportamientos Restrictivos**:
  - `enabledPlugins: []` → El agente pierde acceso a todos los plugins externos.
  - `allowedTools: []` → El agente no puede usar tools externas.
  - `allowedSkills: []` → 🛑 Actualmente **NO** está permitido y el Factory lanzará un error de validación, previniendo un agente que quede silenciado.
  - Excluir explícitamente `"send_message"` (ej. usando `["none"]`) creará agentes que operen en silencio sin reportar estado de vuelta al usuario.

## Ejemplos Incluidos
El framework contiene tres perfiles demo pre-construidos en `/agents/`:
1. **`standup-demo`**: Un comediante de tecnología puro, con un tono conversacional que omite todas las herramientas externas e ignora la skill `none`.
2. **`meat-sales-demo`**: Un agente de ventas sin conexión al exterior, que responde consistentemente sobre cortes de carne y no accede al sistema de archivos.
3. **`logistics-demo`**: Un agente de soporte capaz de registrar tickets, que ilustra el principio de mínimo privilegio al usar *únicamente* `enabledPlugins: ["write_file"]` y `allowedTools: ["write_file"]`.

## Buenas Prácticas
- **Mantener `systemInstructions` claras y cortas**: La identidad principal debe ser directa. Los casos y flujos más grandes deben dividirse en `rules`.
- **Usar `rules` para la lógica dura**: Si un ticket logístico siempre necesita un código, decláralo como rule y no como system instruction.
- **Proteger `send_message`**: No remuevas `"send_message"` de `allowedSkills` salvo que estés construyendo un worker de background en sistemas avanzados.
- **Mínimo Privilegio**: No incluyas arrays de tools innecesarias para agentes estrictamente conversacionales. Si basta con el LLM base, deja `enabledPlugins: []`.

## Limitaciones Actuales
- Todavía no hay soporte explícito de un orquestador Multi-Agent que encadene múltiples de estos perfiles de forma transparente en el mismo hilo.
- Aún no se puede pasar una ruta explícita `--agent-profile /tmp/external.json` (solo se autodescubren y referencian por ID desde `agents/`).
- No existe hot-reload de perfiles (cambios en JSON obligan a reiniciar el CLI).
- No hay comandos en el REPL (ej. `/use-agent`) para pivotear dinámicamente entre personalidades en vivo.
- No hay "Capability Packs" (ej. "darle acceso completo al pack GitHub").

## Troubleshooting
- **Error: Agent profile not found**: Verifique que exista `agents/<agentId>/profile.json`.
- **Error: Invalid agent id**: Path traversal intentado en CLI (ej. `--agent ../id`).
- **Error: Missing required field**: El `profile.json` no contiene `id`, `name`, `description` o `persona.systemInstructions`.
- **Error: AgentProfile references unknown plugin**: Se definió un plugin en `enabledPlugins` que no existe globalmente.
- **Error: AgentProfile references disabled plugin**: Se intentó encender un plugin que el `agent.config.json` mantiene desactivado.
- **Error: AgentProfile.allowedTools references unknown or disabled tool**: El perfil exige una herramienta, pero esta no se pudo localizar en los plugins cargados.
- **Error: AgentProfile.allowedSkills cannot be empty**: Se intentó dejar un agente interactivo sin la base de comunicación con el humano.
