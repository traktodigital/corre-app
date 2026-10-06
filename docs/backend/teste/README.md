# Teste das travas de segurança (local)

Prova que `../seguranca-fase1.sql` bloqueia os ataques mesmo com as políticas
atuais **abertas** (pior caso). Roda num Postgres descartável, nunca em produção.

```sh
# Postgres local descartável (porta 54329)
initdb -D /tmp/corre-pg -U postgres -A trust
pg_ctl -D /tmp/corre-pg -o "-k '' -c listen_addresses=localhost -p 54329" start
createdb -h localhost -p 54329 -U postgres corre

psql -h localhost -p 54329 -U postgres -d corre -f 1-stub-supabase.sql
psql -h localhost -p 54329 -U postgres -d corre -f ../seguranca-fase1.sql
psql -h localhost -p 54329 -U authenticator -d corre -f 2-ataques.sql
psql -h localhost -p 54329 -U postgres -d corre -f 3-backend.sql
```

Toda linha deve começar com `OK`. Qualquer `FALHA` é brecha.

Cobertura (69 ataques + 7 checagens de backend): entregador se promover a
admin, validar o próprio resgate, forjar código/valor/horário, apagar resgate,
ler dados de outro, resgatar em nome de outro, toque duplo gerando 2 códigos,
rate limit de geração, se filiar/reativar sozinho; admin de associação vendo
outra associação; parceiro validando por UPDATE direto, como outro parceiro,
código vencido ou já usado, força bruta com bloqueio progressivo; tarifa do
plano do parceiro gravada na validação; estorno com motivo, uma vez, só do
próprio parceiro; fatura sem estornados; anonimização na exclusão de conta;
migration fechando códigos vencidos e trocando o UNIQUE global do código.

Depois de aplicar em staging, repita os ataques de verdade pelo app/API com
dois entregadores de teste.
