# Checkpoint de Sprint: Selección de Proveedor LLM y CLI

**Fecha de Cierre:** Mayo 2026

## Resumen del Sprint
Se completó de forma exitosa la refactorización de inicialización del CLI para soportar la inyección dinámica de proveedores de Inteligencia Artificial. Se superaron los objetivos de testing, logrando una ejecución limpia sin modificar la estructura interna agnóstica (`core/`), confirmando la viabilidad de la arquitectura desacoplada propuesta para el framework.

## Objetivos Cumplidos
- [x] Extracción de lógica de parseo de dependencias a un `AdapterFactory`.
- [x] Inyección condicional de adaptadores `MockLLMAdapter` y `OpenAIAdapter`.
- [x] Validación temprana de credenciales (`--api-key`) antes de iniciar procesos pesados (`Kernel`).
- [x] Protección del input del usuario ignorando con seguridad las nuevas banderas paramétricas del CLI.
- [x] Estabilización de la arquitectura base del CLI y del flujo general de mensajes.

## Archivos y Módulos Afectados
- **`apps/cli/AdapterFactory.ts`** *(NUEVO)*: Absorbe la lógica de enrutamiento y default de LLM (`gpt-4o-mini`).
- **`apps/cli/cli.ts`** *(MODIFICADO)*: Integración de la fábrica para proveer la instancia validada al motor.
- **`apps/cli/CommandHandler.ts`** *(MODIFICADO)*: Refactorización en el iterador de argumentos posicionales para salto paramétrico.
- **`tests/cli/*`**: Generación e integración de nuevos tests de Vitest, con mocks locales para evitar llamadas de red indeseadas a APIs de terceros.

## Validaciones Realizadas
1. **Tests Automatizados:** `npx vitest run` ejecutado exitosamente con 100% de pase (82/82 pruebas).
2. **Smoke Tests CLI (Manuales):**
   - Validación de caída segura por proveedor inexistente.
   - Validación de caída segura por omisión de `api-key`.
   - Validación del "Wiring" end-to-end usando una clave falsa, confirmando la reacción del framework de normalización de errores ante un código HTTP `401`.

## Decisiones Técnicas Tomadas
- **Aislamiento en CLI:** Se decidió no modificar en absoluto el `core/` para esta feature. La configuración paramétrica es problema exclusivo del entorno consumidor (CLI).
- **Default a gpt-4o-mini:** Proveer una experiencia de bajo costo y alta velocidad sin forzar al usuario a declarar el modelo por defecto.
- **Falla Rápida (Fail-Fast):** En lugar de caer de forma silenciosa a un `mock` si los parámetros fallan, el sistema arroja errores explícitos mediante el `Renderer`.

## Riesgos Conocidos
- La provisión manual de tokens mediante banderas (`--api-key`) en línea de comandos expone claves críticas en el historial del bash del usuario, lo cual representa un riesgo de seguridad latente en entornos locales compartidos o de despliegue automatizado.

## Sprint: Soporte de OPENAI_API_KEY
Se complementó la selección de proveedor añadiendo soporte de fallback seguro para credenciales.
- `AdapterFactory` ahora lee nativamente `process.env.OPENAI_API_KEY`.
- La bandera explícita `--api-key` mantiene prioridad para sobreescribir la configuración del entorno.
- Se implementaron y validaron reglas de precedencia, incluyendo el manejo estricto de testing aislando el `process.env` con Vitest (`vi.stubEnv`).
- Esto elimina el riesgo de exponer contraseñas en el historial del shell local, sin añadir la sobrecarga de dependencias de terceros (`dotenv`).

## Deuda Técnica y Pendientes Recomendados
1. **Actualizar Ayuda Visual:** El comando interactivo `/help` y la bandera `--help` estática manejadas por `Renderer.ts` no han sido actualizadas y no describen los flags `--llm`, `--model` ni `--api-key`.
2. **Persistencia Real:** Transformar las operaciones de workspace en el `ProjectDirectoryAdapter` simulado hacia un adaptador real del sistema de archivos local (`fs`).
