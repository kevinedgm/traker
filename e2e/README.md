# E2E local de Traker

El runner levanta Vite en un puerto dedicado, verifica Supabase local y ejecuta
cada escenario en un contexto nuevo de Chromium. Antes y después de cada caso
elimina `localStorage`, `sessionStorage`, IndexedDB, Cache Storage y registros
de service worker.

## Comandos

```sh
npm run test:e2e
npm run test:e2e:headed
npm run test:e2e -- --scenario=01
```

Supabase debe poder arrancar con Docker. Si no está activo, el runner ejecuta
`supabase start --exclude edge-runtime,studio`; sólo detiene la instancia si él
mismo la inició y nunca usa `--no-backup`.

## Datos y evidencia

Las pruebas usan exclusivamente fixtures sintéticos. En cada corrida se crea
un usuario local temporal, se comprueba su autenticación y se elimina en el
`finally`. El reporte queda en `e2e/artifacts/report.json` y sólo contiene IDs
de escenario, códigos de fallo, rutas sin query string y métricas técnicas. No
guarda nombres personales, notas, emociones, credenciales ni cuerpos HTTP.

Una captura sintética se conserva únicamente cuando falla un escenario; una
ejecución posterior aprobada elimina la captura obsoleta de ese caso.
