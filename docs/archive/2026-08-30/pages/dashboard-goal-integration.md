# Pantalla: Dashboard / Hoy

## Objetivo

Mostrar en una sola vista qué puede hacer la persona hoy. Debe reunir una Meta prioritaria y los Hábitos activos, pero diferenciarlos claramente: una Meta representa una dirección con un siguiente paso; un Hábito representa una práctica repetida que se registra cada día.

## 1. Encabezado

Debe mostrar:

- Fecha actual.
- Saludo con el nombre de la persona cuando esté disponible.
- Mensaje amable: «Cada registro es un paso adelante» o «Podemos retomar desde aquí».
- Botón «Nuevo» para crear un Hábito.

## 2. Meta prioritaria de hoy

Mostrar como máximo una Meta, antes de las métricas y los Hábitos.

Debe contener:

- Etiqueta «Tu foco» para diferenciarla de los Hábitos.
- Título de la Meta.
- Título del siguiente paso concreto.
- Versión mínima de la acción, cuando exista.
- Estado: lista para comenzar, sesión en curso o bloqueada.
- Acción principal: «Empezar ahora», «Continuar sesión» o «Adaptar el paso».
- Acceso secundario para consultar el detalle completo de la Meta.

La Meta se elige en este orden:

1. Meta con una sesión ya iniciada.
2. Primera Meta marcada como foco.
3. Primera Meta activa con una acción disponible.

Si no existe una Meta con siguiente paso, esta sección no se muestra. No debe reemplazarse por contenido inventado ni por una lista de todas las Metas.

## 3. Aviso de recordatorios

Si existen recordatorios configurados pero no pueden funcionar, mostrar:

- Mensaje «Los recordatorios no están activos».
- Explicación breve.
- Acción para abrir el diagnóstico.

## 4. Resumen de Hábitos

Cuando existan Hábitos activos, mostrar:

- **Días construidos:** total de días registrados y total de días transcurridos. Aclarar que el progreso no se reinicia.
- **En curso:** cantidad de Hábitos activos y una representación breve del progreso de hasta ocho Hábitos.

Estas métricas pertenecen sólo a Hábitos. No deben mezclar sesiones o acciones de Metas.

## 5. Invitación a retomar

Si no hay registros recientes, mostrar:

- «¿Quieres continuar hoy?».
- «Un registro pequeño también cuenta».

No mostrar racha rota, días perdidos, deuda ni lenguaje de atraso.

## 6. Cierre del día

Por la tarde, si quedan Hábitos sin registrar, mostrar:

- Pregunta «¿Cerramos el día?».
- Cantidad de Hábitos pendientes.
- Acción para registrar rápidamente cada uno.

## 7. Lista «Continúa hoy»

Mostrar todos los Hábitos activos. Cada fila debe contener:

- Icono y color identificador.
- Nombre del Hábito.
- Horario del recordatorio o «Todo el día».
- Día actual y duración total, por ejemplo «Día 8 / 30».
- Porcentaje y barra de progreso.
- Vista breve de los primeros días registrados.
- Indicador de si ya fue registrado hoy.
- Botón de registro rápido.
- Acceso al detalle del Hábito.

El registro rápido ofrece cuatro resultados:

- Completo.
- Bien.
- Mínimo.
- Hoy no.

Después de elegir, confirmar con un mensaje breve y no punitivo.

## 8. Estado sin Hábitos

Cuando no haya Hábitos, mostrar:

- Título «Empieza hoy».
- Explicación de que cualquier registro suma.
- Acción «Crear mi primer hábito».

La Meta prioritaria puede seguir apareciendo aunque no existan Hábitos.

## Jerarquía visual

1. Saludo y creación de Hábito.
2. Meta prioritaria, si existe.
3. Alertas operativas, sólo cuando sean necesarias.
4. Resumen de Hábitos.
5. Invitación de retorno o cierre del día.
6. Lista de Hábitos.

## Límites del rediseño

- Metas y Hábitos comparten Aurora 2, pero no deben parecer la misma entidad.
- Mostrar sólo una Meta en el Dashboard; la lista completa vive en su propia pantalla.
- No desplazar ni ocultar la creación y el registro diario de Hábitos.
- No mezclar métricas de Hábitos con el progreso de Metas.
- En móvil, la lectura debe conservar el orden definido.
