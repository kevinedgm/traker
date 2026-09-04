# Pantalla: listado de Metas

## Objetivo

Entender qué metas están activas, cuáles están en foco y cuál es su siguiente acción. Debe poder abrir una meta o crear otra sin interpretar la pantalla como una lista de pendientes atrasados.

## Debe mostrar

1. Título y explicación breve.
2. Acción `Nueva meta`.
3. Estado de carga, error, vacío o listado.
4. Metas enfocadas primero; después activas, pausadas y cerradas.
5. En cada Meta:
   - Título.
   - Estado: activa, pausada, completada o reformulada.
   - Prioridad de foco, cuando corresponda.
   - Título y estado del siguiente paso.
   - Versión mínima, cuando exista.
   - Si no hay siguiente paso, definición de terminado.
   - Indicación visual de que puede abrirse para ver el detalle.

## Estados obligatorios

- Cargando.
- Error recuperable con `Intentar de nuevo`.
- Vacío con acceso a la primera meta.
- Lista con textos largos y varias categorías de estado.
- Funcionalidad no disponible: la pantalla y sus accesos no deben mostrarse.

## Acciones

- Crear una meta nueva.
- Abrir una meta para consultar su detalle.
- La etiqueta «Foco 1», «Foco 2» o «Foco 3» comunica prioridad, no porcentaje de progreso.

## Libertad de rediseño

Puede cambiar la estructura del listado, filtros, densidad y tratamiento del estado. Debe mantener lectura rápida, orden de foco, áreas táctiles de 44 px, contraste y continuidad con Aurora 2.
