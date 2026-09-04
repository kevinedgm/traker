# Pantalla: detalle de Hábito

## Objetivo

Mostrar la identidad, el avance y el registro diario de un Hábito. La persona debe poder entender cómo va, registrar cualquier día válido y administrar el Hábito sin sentirse evaluada.

## Encabezado

Debe mostrar:

- Acción para volver al Dashboard.
- Nombre del Hábito.
- Porcentaje actual de progreso.
- Menú con «Editar hábito», «Pausar hábito» y «Eliminar hábito».

## Identidad del Hábito

- Icono y color identificador.
- Nombre.
- Duración total en días.
- Estado «En camino» o «Pausado».

## Resumen de progreso

Debe mostrar:

- Porcentaje general y barra de progreso.
- Días construidos frente a duración total.
- Mensaje «Podemos seguir desde aquí».
- Día actual.
- Cantidad de días construidos.
- Cantidad de días flexibles.
- Resultado de la semana actual.
- Acceso a estadísticas ampliadas.

## Registro diario

Debe mostrar una cuadrícula de días y una leyenda con:

- Excelente.
- Bien.
- Mínimo.
- Flexible.
- No realizado.

Cada día debe indicar su estado sin depender únicamente del color. Al seleccionar un día, debe abrirse su registro para elegir nivel y, si aplica, añadir emoción, energía o una nota.

## Acciones y confirmaciones

- Editar muestra los datos actuales del Hábito.
- Pausar conserva todo el progreso.
- Eliminar requiere confirmación y advierte que también elimina el progreso.
- Cancelar una acción destructiva siempre debe ser visible.

## Estados obligatorios

- Hábito activo o pausado.
- Día sin registrar o ya registrado y editable.
- Hábito no encontrado, con acción para volver.
- Confirmación de eliminación.
- Móvil en una columna y escritorio con resumen y cuadrícula.

## Límites del rediseño

- No usar rachas como métrica principal.
- No presentar días flexibles o no realizados como fracaso.
- Mantener legibles nombre, números y cuadrícula.
- El color identifica al Hábito, pero nunca puede ser la única señal de estado.

