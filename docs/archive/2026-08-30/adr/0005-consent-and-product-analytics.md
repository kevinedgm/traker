# ADR-0005: consentimiento, privacidad y analítica responsable

- Estado: Aceptada
- Fecha: 2026-08-25

## Contexto

Metas puede almacenar motivos, notas, energía, bloqueos y evidencias personales. El usuario autorizó recopilar la información con consentimiento, pero un consentimiento global no elimina el principio de minimización ni debe mezclar funcionalidad necesaria con analítica.

## Decisión

Separar tres finalidades:

1. Almacenamiento local necesario para funcionar.
2. Sincronización opcional con cuenta.
3. Analítica de producto opcional.

El consentimiento será explícito, granular, revocable, versionado y comprensible. Los eventos analíticos no incluirán títulos, motivos, notas, definiciones de terminada, bloqueos ni evidencias textuales.

Datos analíticos permitidos como categorías:

- Tipo de evento funcional.
- Duraciones y rangos agregables.
- Estado anterior y posterior.
- Uso de versión mínima.
- Regreso por ventana temporal agregada.
- Tipo de cierre.
- Errores y estado de sincronización.

## Alternativas

- Consentimiento único para todo: sencillo, pero poco transparente. Rechazada.
- No recopilar ninguna métrica: máxima privacidad, pero dificulta validar daño o utilidad. Rechazada para el piloto, aunque el usuario puede elegirla.
- Analizar texto personal: alto riesgo y no necesario para la hipótesis principal. Rechazada.

## Consecuencias

- Cada evento incluye `consent_version` y no contenido personal.
- Revocar analítica detiene envíos futuros y ofrece borrado de datos asociados.
- Deben definirse proveedor, retención, exportación y eliminación antes del piloto.
- La métrica principal nunca será tiempo dentro de la aplicación.

