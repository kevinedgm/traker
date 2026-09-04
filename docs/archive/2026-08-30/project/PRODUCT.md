# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Personas adultas con TDAH, diagnosticado o no, que buscan crear y mantener hábitos y metas sin sistemas punitivos, presión por rachas ni sobrecarga de planificación.

## Product Purpose

Traker ayuda a convertir intenciones en hábitos repetibles y metas con siguientes pasos concretos. El éxito consiste en que la persona pueda comenzar, registrar, adaptar, pausar y retomar conservando contexto y progreso.

## Positioning

«Regresar también es avanzar»: una ausencia, una versión mínima o una adaptación forman parte del proceso y nunca se convierten en castigo visual o emocional.

## Operating Context

La experiencia principal ocurre en móvil y debe funcionar también en escritorio. Traker es una aplicación web progresiva instalable, con service worker y funcionamiento local sin conexión. Incluye un dashboard diario, registro rápido de hábitos, detalle e historial, sesiones enfocadas para metas, progreso, recordatorios, privacidad y sincronización opcional.

## Capabilities and Constraints

- Hábitos y Metas son entidades distintas y no comparten métricas.
- Los Hábitos se registran por día con niveles flexible, mínimo, bien y completo.
- Las Metas tienen definición de terminado, siguiente acción, versión mínima, sesiones, bloqueos, adaptación, pausa y reformulación vinculada.
- Las Recompensas son opcionales y las crea la persona; pueden vincularse a un hábito cumplido hoy, una frecuencia semanal de hábito o una meta completada.
- Cada condición cumplida desbloquea una recompensa que no expira. Usarla es una decisión voluntaria y no modifica el progreso del hábito o la meta.
- La rueda de Recompensas sólo se abre por acción explícita y sólo puede elegir entre recompensas ya desbloqueadas y disponibles.
- La aplicación funciona localmente sin cuenta.
- Sincronización y analítica requieren consentimientos independientes y revocables.
- La ausencia de actividad no cambia estados automáticamente.
- Se preservan arquitectura funcional, flujos, datos y nombres principales: Hoy, Progreso, Ajustes, Hábito, Metas, Notificaciones y Cuenta.
- Los estados canónicos son: Pendiente, Iniciado, Parcial, Completado, Adaptado, Pospuesto, Pausado, Retomado, Omitido y Sin registro.
- Mínimo, Bien, Excelente y Día flexible son intensidades del registro, no juicios sobre la persona.
- En cada pantalla existe una sola acción primaria.

## Brand Commitments

- Nombre: Traker.
- Filosofía: «Regresar también es avanzar».
- Idioma: español de México, tratamiento de «tú» y frases breves.
- Aurora 2 es la autoridad visual para toda la aplicación.
- El mark original de la «T» conserva su geometría y recibe el tratamiento Aurora; no se inventa un logotipo nuevo.
- El logotipo tipográfico es «Traker».
- La iconografía del sistema y los iconos de Hábito pertenecen a Lucide. No se usan emojis ni caracteres Unicode como sustitutos de iconos.
- La voz describe situaciones y ofrece acciones sin juzgar.
- Las ausencias se nombran con calma y los logros se reconocen sin exageración.
- Nunca se usa lenguaje de racha perdida, fracaso, retraso, deuda, disciplina personal o recuperación de tiempo perdido.

## Evidence on Hand

- Sistema de diseño Aurora 2 completo entregado por el usuario, con fundamentos, tokens para tema oscuro y claro, marca, 39 componentes, patrones y doce pantallas de referencia.
- Aplicación funcional existente con flujos de Hábitos, Metas, Progreso, Ajustes, autenticación y estados del sistema.
- No se deben fabricar testimonios, diagnósticos, métricas clínicas ni afirmaciones médicas.
- La reorganización de Inicio y Resumen para escritorio en dos o tres columnas permanece como trabajo de producto pendiente; el kit de referencia valida principalmente vistas móviles de 390 px.

## Product Principles

- Retomar importa tanto como mantener continuidad.
- Un paso pequeño es una versión válida del progreso.
- Mostrar una decisión principal por momento reduce carga cognitiva.
- El historial aporta contexto; no funciona como puntuación.
- La privacidad y la elección permanecen visibles y reversibles.
- La ausencia de un registro se comunica como información neutral, nunca como error.
- Una recompensa reconoce una condición cumplida sin convertirla en obligación, deuda ni medida del valor de la persona.

## Accessibility & Inclusion

WCAG AA como mínimo, áreas táctiles de al menos 44 × 44 px, foco visible, navegación completa por teclado, texto escalable sin recortes, movimiento reducido y estados diferenciados por forma o texto además del color. Los paneles y diálogos deben controlar el foco y poder cerrarse con Escape.
