# Supabase local — Traker

Esta instancia usa puertos `553xx` para convivir con la instalación local separada de `traker-palenque`, que ocupa los puertos predeterminados `5432x`.

## Arrancar

Desde la raíz del proyecto:

```sh
supabase start --exclude edge-runtime,studio
```

Servicios principales:

- API: `http://127.0.0.1:55321`
- REST: `http://127.0.0.1:55321/rest/v1`
- PostgreSQL: `127.0.0.1:55322`
- Mailpit: `http://127.0.0.1:55324`

Studio y Edge Runtime se excluyen porque Docker Desktop todavía no comparte `/Applications/XAMPP/xamppfiles/htdocs/traker/supabase`. Para habilitarlos, agrega `/Applications/XAMPP/xamppfiles/htdocs` en Docker Desktop → Settings → Resources → File Sharing y después ejecuta `supabase start` sin exclusiones.

## Verificar

```sh
supabase status
supabase migration list --local
supabase db advisors --local --type security --level warn
supabase db advisors --local --type performance --level warn
```

Docker Desktop también impide que `supabase test db` monte la carpeta de pruebas mientras no se comparta la ruta anterior. El equivalente transaccional es:

```sh
docker exec -i supabase_db_traker-local \
  psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
  < supabase/tests/integrated_personal_model.test.sql
```

El archivo de prueba abre una transacción y termina con `ROLLBACK`, por lo que no conserva usuarios ni datos de prueba.

## Detener

```sh
supabase stop
```

No uses comandos de `reset` salvo que quieras eliminar y reconstruir expresamente toda la información local desde las migraciones.
