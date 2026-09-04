# Elemento: formulario de acción

## Objetivo

Crear o reformular una acción realizable vinculada a una Meta. La reformulación crea una nueva versión relacionada; no borra el historial anterior.

## Datos que captura

- Título de la acción, obligatorio.
- Versión mínima realizable.
- Nivel de energía: bajo, medio o alto.
- Estimación por rango, no precisión ficticia.
- Motivo de adaptación cuando el flujo lo requiere.

## Acciones

- Guardar la acción cuando los datos sean válidos.
- Cancelar y salir sin guardar cambios.

## Jerarquía necesaria

1. Qué acción se va a realizar.
2. Cuál es su versión mínima.
3. Cuánta energía y tiempo parece requerir.
4. Motivo de cambio si es una reformulación.
5. Guardar y cancelar.

## Estados a diseñar

- Vacío.
- Edición con valores iniciales.
- Error de campo requerido.
- Envío en curso.
- Reformulación con contexto de la acción anterior.
- Móvil con teclado abierto.

## No negociables

- Etiquetas siempre visibles; el texto de ejemplo no puede ser la única explicación.
- Mientras se guarda, el botón principal debe bloquear acciones repetidas y mostrar actividad.
- La versión mínima debe sentirse válida, no inferior.
- El motivo de adaptación es información privada y no debe aparecer en analítica.
- Conservar navegación por teclado, mensajes de error asociados y foco visible.

## Libertad de rediseño

Puede convertirse en pasos progresivos, hoja lateral o modal sólo si el usuario mantiene contexto, puede cancelar y entiende qué se guardará. Evitar formularios visualmente pesados para una acción corta.
