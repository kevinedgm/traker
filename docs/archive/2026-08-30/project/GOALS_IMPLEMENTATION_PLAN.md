# Traker Metas — plan de implementación

## Premisas confirmadas

- Traker Aurora es la fuente de verdad visual y sustituye la dirección cyber-minimal neón del código.
- Outfit será la fuente de interfaz; Instrument Serif se reserva para momentos emocionales concretos.
- El MVP funciona anónimamente/offline y sincroniza al iniciar sesión.
- El límite de metas en foco es configurable, recomendado inicialmente en tres.
- Una reformulación crea una nueva meta vinculada; la original permanece cerrada.
- El recorrido orgánico queda fuera del MVP.
- Habrá investigación con usuarios y revisión de profesionales con experiencia clínica.
- No se implementa todavía ninguna funcionalidad: este documento define la secuencia posterior.

## Fase 0 — decisiones técnicas y baseline

Documentos ejecutables de esta fase:

- `docs/adr/0001` a `0005`.
- `GOALS_DOMAIN_CONTRACT.md`.
- `AURORA_INTEGRATION_MAP.md`.
- `PHASE_0_VALIDATION_PLAN.md`.

### Trabajo

- Registrar estados, eventos y reglas de integridad definitivos.
- Elegir librería/wrapper de IndexedDB o implementar un adaptador mínimo.
- Definir protocolo de outbox, versiones y conflictos.
- Incorporar los tokens Aurora mediante una capa compatible con los tokens actuales.
- Definir la migración gradual de Hábitos sin mezclarla con la lógica de Metas.
- Adaptar assets Aurora y validar su carga offline en la PWA.
- Incorporar Vitest, Vue Test Utils y Playwright.
- Crear pruebas de caracterización de persistencia, auth y Hábitos.
- Realizar baseline de accesibilidad.

### Criterios de aceptación

- Las decisiones tienen ADR o sección equivalente.
- Las pruebas existentes de caracterización pasan.
- La arquitectura permite desactivar Metas con feature flag.
- Ningún cambio visual no relacionado aparece en Hábitos.

### Decisiones humanas restantes

- Proveedor o mecanismo de analítica.
- Periodos de retención y borrado.
- Tamaño y composición del piloto.

## Fase 1 — dominio local y MVP navegable

### Trabajo

- Tipos/esquemas y transiciones puras.
- Repositorio local e IndexedDB.
- Store Pinia normalizado.
- Rutas, lista de metas y detalle.
- Crear meta, definición de terminada y siguiente acción.
- Versión mínima, energía y rango de tiempo.
- Sesión de trabajo restaurable.
- Registro parcial y feedback inmediato.
- Pausa, regreso, cierre y reformulación vinculada local.
- Configuración de metas en foco.

### Pruebas

- Unitarias de cada transición válida e inválida.
- Persistencia tras recarga y cierre abrupto.
- Navegación por teclado y lector de pantalla.
- E2E completo sin conexión.
- Movimiento reducido y contraste.
- Fidelidad a tokens Aurora, temas oscuro/claro y componentes de referencia.

### Criterios de aceptación

- El flujo completo funciona sin cuenta y sin red.
- Sólo la siguiente acción es obligatoria.
- Una ausencia no crea deuda ni pérdida.
- Reformular conserva la meta original y crea un vínculo verificable.
- Superar el límite de foco nunca bloquea.
- Hábitos continúa funcionando sin regresiones.

## Fase 2 — esquema remoto y sincronización

### Trabajo

- Migraciones aditivas, índices y RLS.
- Servicios Supabase del dominio.
- Outbox idempotente y pull incremental.
- RPC atómica de reformulación.
- Tombstones y resolución de conflictos.
- Asociación de datos anónimos al usuario al iniciar sesión.

### Pruebas

- Políticas RLS entre dos usuarios.
- Reenvío de una misma operación.
- Edición concurrente en dos dispositivos.
- Eliminación offline y posterior reconexión.
- Creación anónima seguida de login.
- Fallo durante reformulación transaccional.

### Criterios de aceptación

- Ninguna operación duplicada crea registros duplicados.
- Los conflictos de texto no se resuelven silenciosamente.
- El cierre y la reformulación son atómicos.
- Los datos anónimos no se pierden al iniciar sesión.

## Fase 3 — instrumentación responsable y piloto

### Trabajo

- Consentimiento granular y revocable.
- Métricas primarias, diagnósticas y guardrails.
- Exportación y eliminación.
- Prueba moderada con adultos con TDAH y personas sin diagnóstico con patrones semejantes.
- Revisión de copys, riesgos y límites por profesionales con experiencia clínica.

### Hipótesis a evaluar

`siguiente acción + versión mínima + feedback + regreso` aumenta inicio, retorno y cierre sin aumentar culpa o carga.

### Criterios de avance

- Mejora observable en creación→inicio o regreso.
- Carga de registro aceptable.
- Sin deterioro relevante en presión, culpa o autonomía.
- Los participantes comprenden la diferencia entre meta, acción, sesión y hábito.

El piloto no se considerará evidencia clínica ni eficacia terapéutica.

## Fase 4 — segunda iteración condicionada

Funciones candidatas:

- Etapas editables y mapa completo.
- Planes “si-entonces”.
- Calibración de tiempo.
- Cambio de modalidad para recuperar interés.
- Conversión a hábito.
- Recordatorios específicos de metas.

Cada función requiere una hipótesis, métrica, guardrail y mecanismo de desactivación.

Esta fase también puede completar la migración visual de pantallas heredadas de Hábitos hacia Aurora, separada de cambios funcionales.

## Fase 5 — experimentos

- Recorrido orgánico accesible comparado con lista de evidencias.
- Recompensas elegidas por el usuario.
- WOOP guiado.
- Body doubling o compromiso social.
- Descomposición asistida.

El recorrido orgánico sólo avanzará si demuestra comprensión o motivación superiores sin aumentar presión, coste de implementación o barreras de accesibilidad.

## Dependencias

```text
Pruebas y ADR
  → dominio y repositorio local
    → interfaz MVP offline
      → esquema/RLS
        → sincronización
          → consentimiento y piloto
            → segunda iteración/experimentos
```

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Convertir Metas en una lista tradicional | Una sola siguiente acción y backlog bajo demanda |
| Más planificación que acción | Creación corta, borrador y etapas opcionales |
| Pérdida de datos concurrentes | Versiones, eventos append-only y conflicto visible |
| Sync compleja en el MVP | Repositorio aislado, outbox idempotente y feature flag |
| Gamificación manipuladora | Sin economía virtual, pérdida, ranking ni recompensa variable |
| Culpa por ausencia | Regreso sin deuda y copys validados |
| Datos personales en analítica | Exclusión técnica de textos y consentimiento separado |
| Regresión en Hábitos | Migraciones aditivas y pruebas de caracterización |
| Límite paternalista | Configurable, desactivable y no bloqueante |

## Criterio global de terminado

El MVP estará listo para piloto cuando una persona pueda, con o sin cuenta:

1. Crear una meta y definir su cierre.
2. Elegir una acción y una versión mínima.
3. Iniciar y finalizar una sesión.
4. Guardar avance parcial offline.
5. Pausar y regresar sin deuda.
6. Cerrar o crear una reformulación vinculada.
7. Sincronizar posteriormente sin duplicados ni pérdida silenciosa.
8. Completar el flujo con teclado, lector de pantalla y movimiento reducido.

## Fuera de alcance antes del piloto

- Recorrido orgánico.
- Recordatorios de Metas.
- IA generativa.
- Colaboración social.
- Gamificación avanzada.
- Migración completa de Hábitos a IndexedDB.
- Componentes Aurora no requeridos por los flujos del MVP.
