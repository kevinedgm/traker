# Pantalla: crear o reformular una Meta

## Objetivo

Convertir una intención en una meta observable y una primera acción ejecutable, sin exigir un plan completo.

## Campos

- Título de la meta: obligatorio, máximo 120.
- Definición de terminado: obligatoria, máximo 300.
- Motivo personal: opcional y sensible.
- Siguiente acción: obligatoria, máximo 160.
- Versión mínima: opcional.
- Energía: baja, habitual o alta.
- Tiempo: 5, 15, 30, 60 minutos o abierto.

## Estados y validación

- Valores preservados tras error.
- Errores junto al campo correspondiente después de intentar guardar.
- Mientras guarda, la acción principal queda deshabilitada y muestra actividad.
- Error visible y recuperable sin perder la información introducida.
- Al terminar, muestra el detalle de la meta creada.
- Reformulación: cierra la original y crea meta + acción vinculadas atómicamente.

## No cambiar

El motivo sigue siendo opcional. La versión mínima no es una versión inferior. No convertir el formulario en onboarding obligatorio de múltiples pantallas sin preservar errores, teclado y datos introducidos.
