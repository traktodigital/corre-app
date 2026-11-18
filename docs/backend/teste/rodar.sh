#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

run() { psql -X -q "$@"; }
out=$(mktemp -d)

run -U postgres -v ON_ERROR_STOP=1 -f 1-stub-supabase.sql > /dev/null
run -U postgres -f ../seguranca-fase1.sql > /dev/null 2>&1
run -U postgres -v ON_ERROR_STOP=1 -f ../partes/6-aprovacao-filiacao-mobile.sql > /dev/null
run -U postgres -v ON_ERROR_STOP=1 -f ../partes/9-escala.sql > /dev/null 2>&1
run -U authenticator -f 2-ataques.sql > "$out/2.txt"
run -U postgres -f 3-backend.sql > "$out/3.txt"
run -U postgres -f 4-excluir-minha-conta.sql > "$out/4.txt"
run -U postgres -v ON_ERROR_STOP=1 -f ../partes/8-jornada.sql > /dev/null 2>&1
run -U authenticator -f 5-jornada.sql > "$out/5.txt"
run -U postgres -v ON_ERROR_STOP=1 -f ../partes/10-emergencia.sql > /dev/null 2>&1
run -U authenticator -f 7-emergencia.sql > "$out/7.txt"
run -U postgres -v ON_ERROR_STOP=1 -f ../partes/11-rota-3b.sql > /dev/null 2>&1
run -U authenticator -f 8-rota-3b.sql > "$out/8.txt"
run -U postgres -f 6-escala.sql > "$out/6.txt"

ok=$(cat "$out"/*.txt | grep -c '^OK' || true)
falha=$(cat "$out"/*.txt | grep -c '^FALHA' || true)
grep -h '^FALHA' "$out"/*.txt || true
echo "$ok OK, $falha FALHA"
[ "$falha" -eq 0 ] && [ "$ok" -ge 204 ]
