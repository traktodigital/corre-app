select to_char(l.criado_em at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI') as clicou_em,
       u.nome,
       u.telefone,
       l.versao_consentimento
  from public.leads_parceiros l
  join public.usuarios u on u.id = l.usuario_id
 where l.parceiro = '3b'
   and l.criado_em >= (date_trunc('month', (now() at time zone 'America/Sao_Paulo') - interval '1 month')
                       at time zone 'America/Sao_Paulo')
   and l.criado_em < (date_trunc('month', now() at time zone 'America/Sao_Paulo')
                      at time zone 'America/Sao_Paulo')
   and (select c.acao from public.consentimentos c
         where c.usuario_id = l.usuario_id and c.finalidade = '3b_indenizacao'
         order by c.criado_em desc, c.id desc limit 1) = 'aceitou'
 order by l.criado_em;
