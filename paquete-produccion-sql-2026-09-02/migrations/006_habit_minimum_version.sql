-- Traker Aurora — versión mínima de cada hábito.
-- Aditiva y segura para datos existentes.

alter table habits
  add column if not exists minimum_version varchar(160) not null default '';
