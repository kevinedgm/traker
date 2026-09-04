# Pantalla: detalle de Meta

## Objetivo

Ver la dirección, actuar sobre el siguiente paso, recuperarse de un bloqueo, elegir continuidad y revisar la trayectoria acumulada.

## Encabezado de la Meta

Debe mostrar:

- Acción para volver al listado.
- Estado: activa, pausada, completada o reformulada.
- Título de la Meta.
- Motivo personal, cuando exista.
- Prioridad de foco, cuando corresponda.

## Definición de terminado

- Descripción concreta de cómo se sabrá que la Meta está completa.
- Acción para confirmarla como completada, sólo cuando no haya una acción abierta.

## Siguiente paso

Debe mostrar:

- Título de la acción actual.
- Versión mínima realizable, cuando exista.
- Energía y rango de tiempo estimados.
- Estado: disponible, en curso o bloqueado.
- Acción principal para comenzar o continuar una sesión.
- Acción para adaptar el paso si ya no es viable.

## Si el paso está bloqueado

- Explicación del bloqueo, cuando exista.
- Opción para crear una acción más viable.
- La acción anterior permanece en el historial como contexto.

## Si no hay siguiente paso

- Mensaje que indique que la acción anterior terminó.
- Formulario breve para definir la siguiente acción.
- Alternativa para completar la Meta si ya se cumplió su definición de terminado.

## Historial y continuidad

- Sesiones realizadas y duración.
- Avances parciales, bloqueos y acciones completadas.
- Adaptaciones y relación con la acción anterior.
- Fecha o momento de cada registro.
- Acciones para pausar, retomar o reformular sin borrar el historial.

## Estados obligatorios

- Carga y meta inexistente.
- Activa con una acción disponible o en curso.
- Acción bloqueada.
- Activa sin acción después de completar la anterior.
- Pausada y retorno.
- Confirmación de cierre.
- Completada o reformulada.
- Error al guardar, con posibilidad de reintentar.

## Invariantes

- Una meta no puede completarse con una acción abierta.
- Adaptar conserva la acción anterior en el historial y crea otra vinculada.
- Reformular crea otra meta; no reabre la original.
- Pausar cierra primero cualquier sesión en curso.
