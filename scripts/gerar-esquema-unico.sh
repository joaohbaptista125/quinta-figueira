#!/usr/bin/env bash
# Junta migrações num único ficheiro SQL, para colar no SQL Editor do Supabase
# sem usar o CLI.
#
#   ./scripts/gerar-esquema-unico.sh                    # todas
#   ./scripts/gerar-esquema-unico.sh 20260910           # só as que começam assim
#
# O ficheiro corre dentro de uma transacção — ou fica tudo, ou não fica nada —
# e no fim regista as migrações incluídas na tabela de controlo do Supabase,
# para que um `supabase db push` futuro as reconheça como já aplicadas.
set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PREFIXO="${1:-}"
SAIDA="${SAIDA:-$RAIZ/esquema${PREFIXO:+-$PREFIXO}.sql}"

mapfile -t FICHEIROS < <(ls "$RAIZ"/supabase/migrations/${PREFIXO}*.sql 2>/dev/null | sort)
if [ ${#FICHEIROS[@]} -eq 0 ]; then
  echo "Nenhuma migração encontrada para o prefixo '${PREFIXO}'." >&2
  exit 1
fi

{
  cat <<'CAB'
-- =============================================================================
-- Quinta da Figueira — migrações reunidas num único ficheiro
-- =============================================================================
-- Gerado por scripts/gerar-esquema-unico.sh a partir de supabase/migrations/.
-- Não editar à mão: alterar as migrações e voltar a gerar.
--
-- COMO USAR
--   1. Painel do Supabase → SQL Editor → New query
--   2. Colar este ficheiro inteiro
--   3. Run
--
-- Corre dentro de uma transacção: ou fica tudo aplicado, ou não fica nada. Se
-- o colares duas vezes, a segunda falha na primeira linha repetida e desfaz-se
-- sozinha, sem estragar o que já lá está.
--
-- NÃO contém dados de demonstração. O supabase/seed.sql do repositório é só
-- para desenvolvimento local e não deve ser corrido aqui.
-- =============================================================================

begin;
CAB

  for f in "${FICHEIROS[@]}"; do
    printf '\n-- %s\n-- %s\n-- %s\n\n' \
      "$(printf '═%.0s' {1..71})" "$(basename "$f")" "$(printf '═%.0s' {1..71})"
    cat "$f"
    printf '\n'
  done

  cat <<'MEIO'

-- ═══════════════════════════════════════════════════════════════════════════
-- Registo das migrações
-- ═══════════════════════════════════════════════════════════════════════════
-- Sem isto, um `supabase db push` feito mais tarde tentaria aplicar outra vez
-- tudo o que está acima e falharia com "já existe".

create schema if not exists supabase_migrations;

create table if not exists supabase_migrations.schema_migrations (
  version    text primary key,
  statements text[],
  name       text
);

insert into supabase_migrations.schema_migrations (version, name) values
MEIO

  ultimo=$((${#FICHEIROS[@]} - 1))
  for i in "${!FICHEIROS[@]}"; do
    nome="$(basename "${FICHEIROS[$i]}" .sql)"
    versao="${nome%%_*}"
    rotulo="${nome#*_}"
    printf "  ('%s', '%s')%s\n" "$versao" "$rotulo" \
      "$([ "$i" -eq "$ultimo" ] && echo "" || echo ",")"
  done

  printf 'on conflict (version) do nothing;\n\ncommit;\n'
} > "$SAIDA"

echo "Gerado: ${SAIDA#"$RAIZ"/}  (${#FICHEIROS[@]} migração(ões), $(wc -l < "$SAIDA") linhas)"
