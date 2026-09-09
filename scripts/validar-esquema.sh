#!/usr/bin/env bash
# Aplica todas as migrações a uma base PostgreSQL descartável e corre os testes
# de RLS. Serve para validar o esquema sem depender do Docker nem do Supabase.
#
#   ./scripts/validar-esquema.sh
#
# Requer: PostgreSQL >= 15 instalado localmente (initdb, pg_ctl, psql).
set -euo pipefail

PORT="${PGPORT_TESTE:-55432}"
CLUSTER="${PGDATA_TESTE:-/var/lib/postgresql/qf-teste}"
PGBIN="$(dirname "$(command -v initdb || echo /usr/lib/postgresql/16/bin/initdb)")"
RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

psql_() { psql -h /tmp -p "$PORT" -U postgres -v ON_ERROR_STOP=1 "$@"; }

if ! pg_isready -h /tmp -p "$PORT" >/dev/null 2>&1; then
  echo "==> A arrancar um cluster PostgreSQL descartável em $CLUSTER"
  rm -rf "$CLUSTER"; mkdir -p "$CLUSTER"
  if [ "$(id -u)" = "0" ]; then
    chown postgres "$CLUSTER"; chmod 700 "$CLUSTER"
    su postgres -c "$PGBIN/initdb -D $CLUSTER -U postgres --auth=trust" >/dev/null
    su postgres -c "$PGBIN/pg_ctl -D $CLUSTER -l $CLUSTER/pg.log -o '-p $PORT -k /tmp' -w start" >/dev/null
  else
    "$PGBIN/initdb" -D "$CLUSTER" -U postgres --auth=trust >/dev/null
    "$PGBIN/pg_ctl" -D "$CLUSTER" -l "$CLUSTER/pg.log" -o "-p $PORT -k /tmp" -w start >/dev/null
  fi
fi

echo "==> Base limpa"
psql -h /tmp -p "$PORT" -U postgres -q -c "drop database if exists qf_teste;" postgres
psql -h /tmp -p "$PORT" -U postgres -q -c "create database qf_teste;" postgres

echo "==> Arremedo do Supabase"
psql_ -q -d qf_teste -f "$RAIZ/supabase/tests/00_shim_supabase.sql"

echo "==> Migrações"
for f in "$RAIZ"/supabase/migrations/*.sql; do
  echo "    $(basename "$f")"
  psql_ -q -d qf_teste -f "$f"
done

echo "==> Seed"
psql_ -q -d qf_teste -f "$RAIZ/supabase/seed.sql"

echo "==> Testes de RLS"
psql_ -d qf_teste -f "$RAIZ/supabase/tests/01_rls.sql"

echo
echo "OK — esquema válido."
