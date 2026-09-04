# Pantalla: sesión de trabajo

## Objetivo

Mantener una única acción visible, medir el bloque sin evaluación y cerrarlo con una descripción honesta del resultado.

## Flujo

1. Muestra la meta, una única acción y el tiempo transcurrido.
2. Al comenzar, registra el inicio para poder recuperar la sesión si la pantalla se cierra.
3. El tiempo mostrado debe continuar correctamente después de una recarga.
4. `Cerrar este bloque` despliega opciones inline.
5. Resultado guardado, confirmación y regreso al detalle.

## Resultados obligatorios

- Acción completada: marca la acción como terminada.
- Avance parcial: guarda lo realizado y un punto claro para retomar.
- Bloqueo: registra qué impidió continuar.
- Cierre intencional: detiene el bloque de forma consciente y conserva el avance.

## Restricciones de rediseño

No usar cuenta regresiva agresiva, sonido obligatorio, métricas de productividad o celebración desproporcionada. Debe sobrevivir recarga, cierre accidental, texto largo, móvil pequeño y movimiento reducido.
