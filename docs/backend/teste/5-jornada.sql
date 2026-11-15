-- Jornada do dia (partes/8-jornada.sql). Toda linha deve começar com OK.
-- Rodar conectado como `authenticator` (igual ao PostgREST), depois de:
--   1-stub-supabase.sql, ../seguranca-fase1.sql, ../partes/8-jornada.sql
-- No fim troca para `postgres` (= Edge Function) para testar a exclusão de conta.
\set QUIET on
\pset tuples_only on
\pset format unaligned
\set A  '00000000-0000-0000-0000-0000000000a1'
\set B  '00000000-0000-0000-0000-0000000000b1'
\set J1 '11111111-0000-0000-0000-000000000001'
\set J2 '11111111-0000-0000-0000-000000000002'
create temp table ok (n serial, caso text, passou bool);
grant all on ok to authenticated, anon;
grant usage on sequence ok_n_seq to authenticated, anon;

-- ── entregador A
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"' || :'A' || '","role":"authenticated"}', false);

-- Tenta forjar dono, horário de início e "suspeita".
insert into jornadas (id, usuario_id, iniciada_em, odometro_inicio, suspeita)
values (:'J1', :'B', now() - interval '3 hours', 1000, true);
insert into ok (caso, passou) values
('jornada nasce do dono, com horário do servidor e sem suspeita forjada', coalesce((
   select usuario_id = :'A' and iniciada_em > now() - interval '1 minute' and not suspeita
     and odometro_inicio = 1000
     from jornadas where id = :'J1'), false)),
('só uma jornada aberta por vez (toque duplo)',
   t($$insert into jornadas (id) values ('$$ || :'J2' || $$')$$) like 'erro%'),
('ganho por app ao encerrar',
   t($$insert into jornada_ganhos (jornada_id, app_id, valor, corridas) values ('$$ || :'J1' || $$', 'ifood', 120, 10)$$) = '1'),
('mesmo app duas vezes na mesma jornada',
   t($$insert into jornada_ganhos (jornada_id, app_id, valor) values ('$$ || :'J1' || $$', 'ifood', 5)$$) like 'erro%'),
('segundo app',
   t($$insert into jornada_ganhos (jornada_id, app_id, valor, corridas) values ('$$ || :'J1' || $$', '99', 80, 4)$$) = '1'),
('app marcado na abertura, ainda sem valor',
   t($$insert into jornada_ganhos (jornada_id, app_id) values ('$$ || :'J1' || $$', 'shopee')$$) = '1'),
('valor + comprovante chegam no encerramento',
   t($$update jornada_ganhos set valor = 0, comprovantes = array['$$ || :'A' || $$/j1/shopee.pdf'], origem = 'comprovante_ia' where app_id = 'shopee'$$) = '1'),
('origem de ganho inválida',
   t($$update jornada_ganhos set origem = 'chute' where app_id = 'shopee'$$) like 'erro%'),
('combustível inválido na jornada',
   t($$update jornadas set combustivel = 'diesel' where id = '$$ || :'J1' || $$'$$) like 'erro%'),
('combustível e foto do painel na jornada aberta',
   t($$update jornadas set combustivel = 'gasolina', foto_painel_inicio = '$$ || :'A' || $$/j1/painel.jpg' where id = '$$ || :'J1' || $$'$$) = '1'),
('abastecimento sem cupom fica marcado',
   t($$insert into abastecimentos (jornada_id, litros, valor_total, combustivel, odometro, foto_odometro, foto_marcador) values ('$$ || :'J1' || $$', 2, 12, 'etanol', 1030, 'x', 'y')$$) = '1'),
('CNPJ do posto inválido',
   t($$insert into abastecimentos (valor_total, posto_cnpj) values (10, '123')$$) like 'erro%'),
('app que não existe no catálogo',
   t($$insert into jornada_ganhos (jornada_id, app_id, valor) values ('$$ || :'J1' || $$', 'inventado', 5)$$) like 'erro%'),
('ganho absurdo (> R$ 5.000 num app)',
   t($$insert into jornada_ganhos (jornada_id, app_id, valor) values ('$$ || :'J1' || $$', 'uber', 9999)$$) like 'erro%'),
('abastecimento na própria jornada',
   t($$insert into abastecimentos (jornada_id, litros, valor_total, origem, foto_cupom, posto_cnpj) values ('$$ || :'J1' || $$', 5, 30, 'foto_ia', 'c', '12345678000199')$$) = '1'),
('não dá pra mexer no horário de início',
   t($$update jornadas set iniciada_em = now() - interval '10 hours' where id = '$$ || :'J1' || $$'$$) like 'erro%'),
('encerrar a jornada',
   t($$update jornadas set status = 'encerrada', km_gps = 60, odometro_fim = 1062, suspeita = false where id = '$$ || :'J1' || $$'$$) = '1');

-- Conferências num comando separado: o snapshot do INSERT acima não vê o que o t() gravou.
insert into ok (caso, passou) values
('preço por litro calculado pelo banco',
   coalesce((select preco_litro = 6 from abastecimentos where jornada_id = :'J1' and not sem_cupom), false)),
('sem_cupom calculado pelo banco (não dá pra forjar)',
   coalesce((select sem_cupom from abastecimentos where jornada_id = :'J1' and foto_cupom is null), false)),
('encerramento com horário do servidor',
   coalesce((select encerrada_em >= iniciada_em and encerrada_em > now() - interval '1 minute'
               from jornadas where id = :'J1'), false)),
('60 km em segundos fica marcada como suspeita (velocidade impossível)',
   coalesce((select suspeita from jornadas where id = :'J1'), false)),
('jornada encerrada não reabre',
   t($$update jornadas set status = 'em_andamento' where id = '$$ || :'J1' || $$'$$) like 'erro%'),
('jornada encerrada não muda km',
   t($$update jornadas set km_gps = 999 where id = '$$ || :'J1' || $$'$$) like 'erro%'),
('resumo da jornada: km, ganho, gasto, lucro, custo/km, ganho/km', coalesce((
   select (r->>'km')::numeric = 60 and (r->>'ganho_total')::numeric = 200
      and (r->>'gasto_combustivel')::numeric = 42 and (r->>'lucro')::numeric = 158
      and (r->>'custo_km')::numeric = 0.7 and (r->>'ganho_km')::numeric = 3.33
      and jsonb_array_length(r->'por_app') = 3
     from (select resumo_jornadas(_jornada_id => :'J1') r) x), false)),
('resumo por app: maior ganho primeiro, ganho por corrida', coalesce((
   select r->'por_app'->0->>'app' = 'ifood'
      and (r->'por_app'->0->>'por_corrida')::numeric = 12
      and (r->'por_app'->1->>'por_corrida')::numeric = 20
     from (select resumo_jornadas(_jornada_id => :'J1') r) x), false)),
('resumo por período (hoje)', coalesce((
   select (r->>'jornadas')::int = 1 and (r->>'km')::numeric = 60
     from (select resumo_jornadas(now() - interval '1 day', now() + interval '1 day') r) x), false)),
('nova jornada depois de encerrar a anterior',
   t($$insert into jornadas (id) values ('$$ || :'J2' || $$')$$) = '1');

-- ── entregador B (outro usuário)
select set_config('request.jwt.claims', '{"sub":"' || :'B' || '","role":"authenticated"}', false);
insert into ok (caso, passou) values
('B não vê jornadas de A', (select count(*) = 0 from jornadas)),
('B não vê ganhos de A', (select count(*) = 0 from jornada_ganhos)),
('B não vê abastecimentos de A', (select count(*) = 0 from abastecimentos)),
('B não altera jornada de A',
   t($$update jornadas set km_gps = 1 where id = '$$ || :'J2' || $$'$$) = '0'),
('B não apaga jornada de A',
   t($$delete from jornadas where id = '$$ || :'J2' || $$'$$) = '0'),
('B não lança ganho na jornada de A',
   t($$insert into jornada_ganhos (jornada_id, usuario_id, app_id, valor) values ('$$ || :'J2' || $$', '$$ || :'B' || $$', 'uber', 10)$$) like 'erro%'),
('B não lança ganho em nome de A',
   t($$insert into jornada_ganhos (jornada_id, usuario_id, app_id, valor) values ('$$ || :'J2' || $$', '$$ || :'A' || $$', 'uber', 10)$$) like 'erro%'),
('B não lança abastecimento na jornada de A',
   t($$insert into abastecimentos (jornada_id, valor_total) values ('$$ || :'J2' || $$', 10)$$) like 'erro%'),
('B não lança abastecimento em nome de A',
   t($$insert into abastecimentos (usuario_id, valor_total) values ('$$ || :'A' || $$', 10)$$) like 'erro%'),
('resumo de B não enxerga a jornada de A', coalesce((
   select (r->>'jornadas')::int = 0
     from (select resumo_jornadas(_jornada_id => :'J1') r) x), false));

-- ── anônimo
reset role;
set role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', false);
insert into ok (caso, passou) values
('anônimo não lê jornadas', t($$select * from jornadas$$) like 'erro%'),
('anônimo não chama o resumo', t($$select resumo_jornadas(now() - interval '1 day', now())$$) like 'erro%'),
('anônimo lê o catálogo de apps', t($$select * from apps_entrega$$) = '9');

reset role;
select format('%-5s %s', case when passou then 'OK' else 'FALHA' end, caso) from ok order by n;

-- ── backend (Edge Function excluir-conta)
\c - postgres
\set QUIET on
select corre_anonimizar_dados(:'A');
select format('%-5s %s', case when ok then 'OK' else 'FALHA' end, caso) from (values
  ('exclusão apaga as jornadas', (select count(*) = 0 from jornadas where usuario_id = :'A')),
  ('exclusão apaga os ganhos (cascata)', (select count(*) = 0 from jornada_ganhos where usuario_id = :'A')),
  ('exclusão apaga os abastecimentos', (select count(*) = 0 from abastecimentos where usuario_id = :'A'))
) v(caso, ok);
