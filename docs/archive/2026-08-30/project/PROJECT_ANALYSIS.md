# Traker — análisis del proyecto

Fecha de análisis: 25 de agosto de 2026.

## Resumen ejecutivo

Traker es una SPA/PWA de seguimiento flexible de hábitos. Su arquitectura actual es adecuada para prototipar el módulo Metas sin sustituir el stack, pero necesita reforzar pruebas, almacenamiento offline y resolución de conflictos antes de crecer hacia un modelo con varias entidades relacionadas.

Metas debe incorporarse como un dominio paralelo a Hábitos. Un hábito representa una conducta recurrente; una meta representa un resultado finito. Compartirán infraestructura, componentes y lenguaje de producto, pero no el mismo modelo de datos.

## Stack tecnológico

- Vue 3.5 con Composition API y componentes `.vue`.
- Pinia 3 para estado de aplicación.
- Vue Router 4 con rutas cargadas de forma diferida.
- Vite 8 como entorno de desarrollo y compilación.
- Tailwind CSS 3, PostCSS y una capa extensa de variables CSS.
- Supabase JS 2 para autenticación, PostgreSQL y sincronización.
- Supabase Edge Functions para recordatorios push.
- `vite-plugin-pwa`, Workbox y service worker personalizado.
- Lucide para iconografía y VueUse como utilidad reactiva.

No se encontraron dependencias ni scripts propios de Vitest, Vue Test Utils, Playwright o Cypress.

## Organización

```text
src/
  components/       UI, layout, hábitos y bloqueo local
  composables/      comportamiento reutilizable, actualmente tema
  layouts/          layout de autenticación
  pages/            vistas asociadas a rutas
  plugins/          persistencia de Pinia
  router/           navegación
  services/         almacenamiento, notificaciones, push y Supabase
  stores/           app, auth, habits y settings
  utils/            iconos, colores y utilidades generales
supabase/
  functions/        Edge Function de recordatorios
  migrations/       esquema, sincronización y notificaciones
public/              manifest assets, iconos y fallback de GitHub Pages
```

## Arquitectura y flujo de datos

```text
Interacción en Vue
  → mutación en Pinia
  → plugin de persistencia escribe localStorage
  → sync.push(operación)
      ├─ online: escribe en Supabase
      └─ offline: agrega a la cola local
          → flushQueue al recuperar conexión
```

Las lecturas remotas se integran en el store mediante `mergeFromCloud`. Los hábitos y sus registros comparan `updatedAt` o `loggedAt`; prevalece la escritura más reciente.

### Evaluación

Beneficios:

- La acción local no depende de la red.
- La aplicación puede utilizarse sin cuenta.
- Los servicios evitan que los stores dependan directamente del cliente Supabase.
- Los UUID generados en cliente facilitan el trabajo offline.

Limitaciones:

- `localStorage` es síncrono, pequeño y no transaccional.
- Last-write-wins puede perder cambios distintos realizados en dos dispositivos.
- Las eliminaciones y reordenamientos complejos necesitan tombstones y operaciones idempotentes.
- Varias entidades de Metas podrían quedar en estados parciales si se persisten por separado.

## Modelo de datos actual

Supabase contiene:

- `habits`: título, apariencia, duración, recordatorio, actividad y timestamps.
- `habit_entries`: día secuencial, estado, emoción, energía y nota.
- `settings`: tema, preferencias, notificaciones y zona horaria.
- `push_subscriptions`: suscripciones por navegador/dispositivo.
- `sent_reminders`: ledger antiduplificación de envíos.

RLS está habilitado y vincula cada registro con `auth.uid()`. Los registros de hábitos dependen de un `day_number`, una forma adecuada para retos de duración fija pero incorrecta para metas finitas no lineales.

## Autenticación y seguridad

Existen dos mecanismos independientes:

- Supabase Auth: correo/contraseña y magic link.
- PIN local: bloqueo de la interfaz.

El PIN se almacena como texto en `localStorage`; por ello debe describirse como bloqueo de conveniencia y no como cifrado o protección fuerte. Metas puede contener motivos y notas sensibles, por lo que éstos no deben incluirse en telemetría aunque el usuario consienta sincronizarlos.

## Navegación y componentes reutilizables

Se pueden reutilizar:

- `AppShell` y navegación responsive.
- `BaseButton`, `BaseInput`, `BaseCard`, `BaseBadge` y `BaseSegmentedControl`.
- Patrones de modal y acciones táctiles de Hábitos.
- Stores de cuenta, ajustes y estado general.
- Servicios de almacenamiento, sincronización, push y notificaciones.
- Patrones de pausa, regreso, energía y progreso acumulado.

Se deben ampliar:

- Formularios por etapas con borrador automático.
- Revelación progresiva y paneles expandibles.
- Diálogos con focus trap, restauración de foco y anuncios accesibles.
- Estado de sincronización y conflicto por entidad.
- Componentes de sesión de trabajo y evidencia de avance.

## Hábitos y recordatorios

Hábitos implementa creación, edición, pausa, eliminación, registros diarios, niveles de avance y estadísticas derivadas. La métrica “días construidos” nunca se reinicia y es coherente con “Regresar también es avanzar”.

Los recordatorios combinan preferencias locales, Web Push y una función programada. `sent_reminders` evita duplicados diarios. Metas puede reutilizar el transporte, permisos y diagnóstico, pero no debe heredar mensajes diarios ni supuestos de recurrencia. Los recordatorios de Metas se posponen hasta después de validar el MVP.

## Sistema visual confirmado: Traker Aurora

La carpeta externa `Traker Design System — Aurora` es la fuente de verdad visual más reciente. Su documentación declara expresamente que Aurora sustituye la dirección cyber-minimal neón presente en el código. Por tanto, el repositorio y el sistema de diseño están en etapas distintas: la arquitectura y la lógica actuales se conservan, pero la implementación visual debe migrar hacia Aurora.

Fundamentos confirmados:

- Tema principal oscuro azul carbón: `#0D1220`, nunca negro puro.
- Tema claro de papel azulado: `#F5F5FA`.
- Acción y avance en azul eléctrico `#6C8CFF`.
- Coral `#F58C6E` para regreso y energía.
- Violeta `#A66CFF` para adaptación y reflexión.
- Cian `#56D6F0` para foco e información.
- Ámbar `#E8B96A` para pausas y recordatorios.
- Destructivo rosa apagado `#E5707F`, nunca usado para ausencia.
- Outfit como tipografía de interfaz y numérica.
- Instrument Serif únicamente para bienvenida, regreso y otros momentos emocionales; nunca en controles.
- Lucide a 1.75 px, iconos de 16/20/24 px y área táctil mínima de 44 px.
- Escala espacial de 4 px; tarjetas de 16/20 px de radio y sheets/modales de 28 px.
- Cinco niveles de profundidad; glass reservado para navegación flotante y paneles temporales.
- Movimiento de continuidad sin rebotes, confeti ni animación decorativa permanente.

El fondo Aurora es atmosférico a nivel de pantalla mediante `--aurora-glow` y grano sutil. Los gradientes permitidos tienen funciones concretas: ambiente, tarjeta protagonista y regreso. No deben añadirse gradientes arbitrarios a cada tarjeta.

### Inventario reutilizable del paquete Aurora

El paquete incluye 38 componentes React con contratos `.d.ts`, documentación y un prototipo de 12 pantallas. El proyecto productivo utiliza Vue, de modo que el JSX es referencia de comportamiento y estilo, no código para importar directamente.

Para Metas son especialmente relevantes:

- `NextStepCard`: una tarjeta protagonista por pantalla, con acción principal y adaptación.
- `ReturnCard`: regreso coral, titular editorial y lenguaje sin culpa.
- `ProgressCard`: evidencia acumulada sin porcentaje como métrica principal.
- `EffortSelector`: esfuerzo mínimo, habitual o de sobra; todos cuentan.
- `MinimalVersionSelector`: versión mínima/habitual/pospuesta sin penalización.
- `StatusTag`: vocabulario común de diez estados.
- `BottomSheet`, `Modal` y `ConfirmDialog`: superficies temporales y gestión de foco.
- `EmptyState`, `OfflineState`, `ErrorState`, `Skeleton`, `Toast` y `Tooltip`.
- `WeeklyPath` y `NonLinearProgress`: gramática visual de estados con forma además de color.

La migración debe extraer los tokens Aurora a la aplicación Vue y adaptar sólo componentes utilizados tres o más veces. Conviene conservar aliases temporales para los tokens antiguos mientras se migran Hábitos y Metas por etapas.

## PWA, responsive y accesibilidad

Fortalezas:

- Manifest instalable, iconos maskable y shortcuts.
- Precache del shell y service worker personalizado.
- Navegación adaptada a escritorio y móvil.
- Estados `focus-visible` y reducción global de movimiento.

Riesgos:

- El manifest sigue describiendo sólo hábitos.
- El precache no resuelve por sí mismo la sincronización transaccional.
- Falta una auditoría WCAG sistemática.
- Deben verificarse teclado, lector de pantalla, zoom, contraste y modales.

## Deuda técnica priorizada

1. Ausencia de pruebas automáticas propias.
2. `localStorage` como almacén estructural principal.
3. Conflictos last-write-wins demasiado gruesos.
4. PIN en texto claro.
5. Duplicación y posibles divergencias entre CSS y Tailwind.
6. Falta de transacciones multientidad e idempotencia explícita.
7. Vistas SQL de rachas aunque la filosofía actual no las prioriza.
8. Falta de una estrategia documentada de rollback de migraciones.

## Decisión para Metas

Conservar el stack. Crear un dominio separado y una capa repositorio que oculte almacenamiento local y remoto. Para el MVP es aceptable reutilizar temporalmente el protocolo actual si se añaden pruebas e idempotencia; para escalar, Metas deberá migrar a IndexedDB y sincronización por operaciones/versiones.
