# Traker

Traker es una aplicación web progresiva (PWA) para crear hábitos, registrar el avance diario y entender cómo influyen el contexto, la energía y el estado emocional en la constancia.

## ¿Para qué sirve?

La aplicación ayuda a convertir una intención en una práctica sostenible. Permite crear hábitos con una duración y frecuencia determinadas, registrar diariamente el nivel de cumplimiento y consultar el progreso acumulado. También puede enviar recordatorios para facilitar el seguimiento.

Traker está pensado especialmente para personas a quienes los sistemas tradicionales de rachas les generan presión o desmotivación. En lugar de presentar una interrupción como la pérdida de todo el progreso, conserva cada día registrado como parte de lo ya construido.

## Objetivo

El objetivo de Traker es facilitar la formación de hábitos mediante un seguimiento flexible, amable y consciente del contexto.

La métrica principal es **días construidos**: la suma de los días en los que hubo progreso. Esta cifra solamente crece y no vuelve a cero cuando una persona deja de registrar durante uno o varios días. Así, la aplicación busca:

- reducir la culpa asociada con romper una racha;
- favorecer que la persona retome un hábito después de una pausa;
- reconocer avances pequeños como progreso válido;
- mostrar patrones entre cumplimiento, energía, emociones y momento del día;
- ofrecer recordatorios útiles sin duplicarlos ni convertirlos en ruido.

## ¿Cómo funciona?

1. La persona crea un hábito y define su duración, días de práctica, color, icono y recordatorio opcional.
2. Desde el panel de hoy consulta sus hábitos activos y registra cuánto avanzó en cada uno.
3. Cada registro puede incluir nivel de cumplimiento, energía, emoción y una nota.
4. La sección de progreso resume los días construidos y genera indicadores a partir del historial.
5. Si hay hábitos pendientes al final del día, la aplicación ofrece un cierre diario rápido.
6. Cuando una persona se ausenta, la interfaz invita a retomar con un registro pequeño, sin reiniciar el progreso anterior.

## Funciones principales

- Creación, edición, pausa y eliminación de hábitos.
- Registro diario con distintos niveles de avance.
- Captura opcional de energía, emoción y notas.
- Panel diario con hábitos activos, pendientes y progreso acumulado.
- Vista detallada y calendario de registros por hábito.
- Estadísticas e insights sobre el historial personal.
- Cierre del día para registrar varios hábitos pendientes rápidamente.
- Recordatorios locales y notificaciones web push.
- Diagnóstico de permisos y funcionamiento de notificaciones.
- Cuenta en la nube mediante Supabase y persistencia local.
- Bloqueo opcional de la aplicación mediante PIN.
- Instalación como PWA en dispositivos compatibles.

## Principios del producto

- **El progreso no se borra:** cada día construido conserva su valor.
- **Retomar también cuenta:** una pausa no convierte el esfuerzo anterior en fracaso.
- **Registrar debe ser sencillo:** la interacción prioriza acciones breves y táctiles.
- **El contexto importa:** energía y emociones ayudan a interpretar el desempeño, no solamente a medirlo.
- **Los recordatorios deben ser confiables:** la aplicación evita envíos duplicados y ofrece herramientas de diagnóstico.

## Público objetivo

Traker puede ser útil para cualquier persona que quiera desarrollar hábitos, pero su experiencia está orientada especialmente a quienes necesitan un sistema flexible y poco punitivo, incluidas personas con dificultades de constancia, organización o atención.

## Tecnología

La interfaz está construida con Vue 3, Vite, Pinia y Vue Router. Supabase proporciona autenticación y servicios en la nube. La experiencia instalable y las notificaciones se apoyan en tecnologías PWA, service workers y web push.

## Desarrollo local

```bash
npm install
npm run dev
```

Para generar una versión de producción:

```bash
npm run build
```

La configuración de las notificaciones push se encuentra en [supabase/PUSH_SETUP.md](supabase/PUSH_SETUP.md).

## Documentación

- El checklist operativo vigente está en
  [TRAKER_PENDING_EXECUTION_PLAN.md](TRAKER_PENDING_EXECUTION_PLAN.md).
- La documentación de análisis, diseño y fases anteriores se conserva en el
  [archivo del 30 de agosto de 2026](docs/archive/2026-08-30/README.md).
