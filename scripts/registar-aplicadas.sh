#!/usr/bin/env bash
# Gera o SQL que declara, na tabela de controlo do Supabase, que todas as
# migrações do repositório já estão aplicadas.
#
#   ./scripts/registar-aplicadas.sh
#
# Serve uma vez só, na passagem do «colar à mão» para o `supabase db push`:
# as migrações coladas no SQL Editor antes de existir essa contabilidade não
# estão registadas, e sem isto o primeiro push tentava aplicá-las outra vez.
#
# NÃO altera o esquema. Só escreve linhas na tabela de controlo, e é seguro
# correr mais do que uma vez.
set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SAIDA="$RAIZ/registar-migracoes-aplicadas.sql"

{
  cat <<'CABECALHO'
-- =============================================================================
-- Declarar as migrações já aplicadas
-- =============================================================================
-- Gerado por scripts/registar-aplicadas.sh. Não altera o esquema: só diz ao
-- Supabase quais as migrações que já correram, para o `db push` não as repetir.
-- Seguro de correr mais do que uma vez.
--
--   Painel do Supabase → SQL Editor → New query → colar → Run
-- =============================================================================

create schema if not exists supabase_migrations;

create table if not exists supabase_migrations.schema_migrations (
  version    text primary key,
  statements text[],
  name       text
);

insert into supabase_migrations.schema_migrations (version, name) values
CABECALHO

  primeira=1
  for f in "$RAIZ"/supabase/migrations/*.sql; do
    base="$(basename "$f" .sql)"
    versao="${base%%_*}"
    nome="${base#*_}"
    [ "$primeira" = 1 ] && primeira=0 || printf ',\n'
    printf "  ('%s', '%s')" "$versao" "$nome"
  done
  printf '\non conflict (version) do nothing;\n\n'

  total="$(find "$RAIZ/supabase/migrations" -name '*.sql' | wc -l | tr -d ' ')"
  printf -- '-- O que ficou registado. Devem aparecer %s linhas.\n' "$total"
  printf 'select version, name\n  from supabase_migrations.schema_migrations\n order by version;\n'
} > "$SAIDA"

echo "Gerado: $(basename "$SAIDA")  ($(grep -c "^  ('" "$SAIDA") migração(ões))"
