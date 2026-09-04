# Traker Metas — validación de Fase 0

## Objetivo

Cerrar los riesgos de arquitectura y experiencia antes de implementar funcionalidad.

## Caracterización técnica requerida

- Persistencia e hidratación de cada store actual.
- Cola offline: enqueue, reintento y flush.
- Login anónimo→cuenta y pull remoto.
- Merge de hábitos por timestamps.
- Registro y eliminación de entradas.
- Rutas base y restauración de SPA/PWA.
- Bloqueo PIN independiente de Supabase.
- Preferencias de tema y movimiento reducido.

Estas pruebas describen el comportamiento actual; no implican aprobar todas sus decisiones.

## Matriz de escenarios de Metas

| Escenario | Resultado requerido |
|---|---|
| Crear offline y recargar | Meta y borrador permanecen |
| Iniciar sesión y cerrar la app | Sesión puede reconstruirse desde timestamps |
| Pausar con sesión activa | Exige resolver/finalizar sesión primero |
| Regresar tras semanas | No crea pendientes ni deuda automática |
| Reformular offline | Cierre y nueva meta se guardan atómicamente local |
| Autenticarse después | Conserva IDs, relaciones y eventos |
| Reenviar una operación | No duplica entidad ni evento |
| Editar el mismo texto en dos dispositivos | Conflicto visible, sin pérdida silenciosa |
| Revocar analítica | Detiene eventos analíticos, no rompe la app |
| Fuente web no disponible | Fallback legible y PWA operable |

## Validación Aurora

- Capturas de lista, detalle, sesión y regreso en 390×844 y 1440×900.
- Temas oscuro y claro.
- Teclado completo y lector de pantalla.
- Zoom a 200 % y 400 %.
- Contraste AA de texto, controles y estados.
- `prefers-reduced-motion`.
- Sin color como único indicador.
- Sin overflow con textos largos en español.

## Investigación con personas

Participantes:

- Adultos con diagnóstico de TDAH.
- Adultos sin diagnóstico con dificultades semejantes.
- Profesionales con experiencia clínica para revisión ética y lingüística.

Tareas:

1. Crear una meta real.
2. Elegir una acción y reducirla.
3. Simular una interrupción.
4. Regresar y decidir continuar, reformular o cerrar.
5. Explicar qué significa el avance mostrado.

Se medirá comprensión, tiempo al primer paso, carga, autonomía, culpa percibida y claridad del cierre. No se evaluará eficacia clínica.

## Gate para comenzar implementación

- ADR aceptadas y sin contradicciones abiertas.
- Contrato de dominio revisado.
- Tokens Aurora con mapa de compatibilidad.
- Estrategia de pruebas acordada.
- Proveedor, retención y eliminación de analítica resueltos antes del piloto, no necesariamente antes del prototipo local.

