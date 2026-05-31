# Sprint 8: Persistencia Mínima (FileEventLog)

## Objetivo del Sprint
Dotar al motor agéntico de la capacidad de recordar contextos entre sesiones mediante una implementación persistente en disco del `EventLog`. 
Para evitar dependencias pesadas y migraciones prematuras a SQLite, implementaremos una solución nativa basada en el sistema de archivos (`fs`) y archivos JSON. El `InMemoryEventLog` existente se mantendrá intacto para uso en tests o flujos efímeros.

## Comportamiento Esperado de `FileEventLog`
- **Inicialización:** El constructor recibirá una ruta de archivo. Creará automáticamente el archivo y sus directorios padre si no existen.
- **Carga (Load):** Al instanciarse, debe cargar y parsear el archivo JSON. Manejará limpiamente archivos vacíos o inexistentes.
- **Tolerancia a Fallos:** Si el archivo JSON está corrupto, la inicialización debe fallar de manera controlada (lanzando un error semántico manejable, no crasheando misteriosamente).
- **Escritura (`append`):** Validará la estructura del evento, lo añadirá al estado interno y sobrescribirá o agregará al archivo JSON de forma segura.
- **Lectura (`getAll`):** Devolverá la lista cronológica de eventos asegurando inmutabilidad (devolviendo una copia profunda o mapeada, no la referencia interna mutable).
- **Transformación de Tipos:** El campo `timestamp` del esquema `Event` debe ser correctamente serializado a string ISO y **deserializado a objetos `Date` nativos** al cargar desde disco.
- **Cero Estado Global:** Varias instancias apuntando a diferentes archivos no deben colisionar.

## Archivos a Crear / Modificar
- `core/events/FileEventLog.ts` (Nuevo)
- `core/events/index.ts` (Actualizar exports)
- `tests/core/events/FileEventLog.test.ts` (Nuevo)

## Contrato Propuesto

```typescript
import { EventLog, Event } from './EventLog';

export class FileEventLog implements EventLog {
  constructor(private readonly filePath: string) {
    // Lógica de carga e inicialización inicial
  }

  public append(event: Event): void { ... }
  public getAll(): Event[] { ... }
}
```

## Pruebas Mínimas Requeridas (`tests/core/events/FileEventLog.test.ts`)
Para las pruebas, es estrictamente requerido usar un directorio temporal (ej. con módulo `os.tmpdir()` o paths efímeros) asegurando que no se modifique la estructura del proyecto ni se deje basura.

- `[ ]` Inicia con un arreglo vacío si el archivo no existe.
- `[ ]` Crea el archivo físico exitosamente al hacer el primer `append()`.
- `[ ]` Persiste un evento correctamente y lo recupera en una **nueva instancia** de la clase apuntando a la misma ruta.
- `[ ]` Mantiene el orden cronológico de los eventos insertados.
- `[ ]` Falla controladamente al hacer `append` de un evento mal formado (usando las mismas reglas base de validación).
- `[ ]` Falla controladamente al instanciarse apuntando a un archivo JSON corrupto.
- `[ ]` Comprueba que el `timestamp` extraído mediante `getAll()` es un prototipo `Date` válido y no un string.
- `[ ]` Verifica que modificar el array devuelto por `getAll()` no altera el estado interno de la clase.

## Fuera de Alcance Explícito
- No se migrará a SQLite ni ninguna otra base de datos relacional/NoSQL.
- No se agregarán librerías externas de base de datos ni ORMs.
- No se implementará el **PolicyEngine**.
- No se emitirán **Eventos de Resultado** (el framework sigue enfocado solo en intenciones).
- No se modificará la integración con CLI (todavía no se conectará `AgentFactory` con este FileEventLog).
- No se implementarán cifrados para API keys en este sprint.
- No se modificarán los contratos base de Eventos salvo descubrimiento de bugs reales.

## Riesgos Técnicos Identificados
- **Corrupción de Archivo:** Si el proceso CLI se detiene forzosamente a mitad de la escritura síncrona/asíncrona con `fs`, el archivo JSON podría quedar truncado e irrecuperable para la próxima sesión.
- **Concurrencia:** Escribir en un archivo plano no es *Thread-Safe*. Si dos instancias del CLI intentan modificar el log simultáneamente, el JSON sufrirá sobrescrituras fatales.
- **Crecimiento Indefinido:** Un JSON que cargue y escriba la totalidad de la historia del proyecto se volverá insostenible en memoria si el log alcanza decenas de miles de entradas. (Esto justifica la futura migración a SQLite).
- **Serialización de Date:** `JSON.stringify` formatea automáticamente el `Date` a ISO-8601, pero `JSON.parse` no hace el paso inverso, requiriendo un `reviver` o parseo manual que es un punto habitual de falla en Typescript.
- **Ubicación Física:** Queda pendiente para el próximo sprint decidir dónde el CLI almacenará estos archivos (ej. en una carpeta `.agent/` por proyecto).

## Siguiente Paso Recomendado
Realizar el respectivo commit de esta planificación en el documento `docs/TASK_SPRINT_8_FILE_EVENT_LOG.md`. Una vez salvaguardada la hoja de ruta, entraremos a la fase de **Implementación Controlada** desarrollando la clase con rigor de pruebas efímeras.
