# Componentes Aurora para Vue

Implementación nativa del catálogo de `Traker Design System — Aurora 2/components`.

```js
import { AuroraButton, AuroraNextStepCard } from '@/components/aurora'
```

Convenciones:

- Los valores controlados usan `v-model`.
- Las acciones se exponen como eventos (`@action`, `@close`, `@primary`).
- El contenido React se traduce a slots (`#icon`, `#footer`, `#actions`).
- Todos los estilos consumen los tokens canónicos de `src/assets/aurora.css`.
- Los nombres llevan prefijo `Aurora` para evitar colisiones durante la sustitución gradual de componentes heredados.

Familias disponibles: `core`, `surfaces`, `feedback`, `forms`, `navigation`, `habits`, `progress` y `goals`.
