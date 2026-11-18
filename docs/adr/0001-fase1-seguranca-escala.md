# ADR-0001 — CORRE: da Fase 1 à escala (segurança, multi-tenant e gargalos)

| | |
|---|---|
| **Status** | Proposto |
| **Data** | 2026-11-15 |
| **Decisores** | Léo Monteiro (negócio/tecnologia), Diogo (dev) |
| **Fontes** | `CORRE_Escopo_Tecnico_Dev_Fase1`, `CORRE_Regras_App_Seguranca_Escala`, código em `src/` e `docs/backend/` |

## 1. Contexto

A Fase 1 (cadastro, área do usuário, carteirinha ASSEMAG, parceiros com resgate) foi
entregue com as travas de banco de `docs/backend/seguranca-fase1.sql`. O Léo pediu
para pensar em **milhões de usuários** e em **várias associações** desde já.

Esta ADR registra:

1. as decisões de arquitetura que passam a valer;
2. a aderência do código atual às regras dos documentos;
3. **pontos limitantes**, **gargalos** e **melhorias**, em ordem de prioridade;
4. as decisões de negócio que ainda faltam.

Premissa: o banco real fica no projeto Supabase `goias-delivery-link` (painel web/Lovable).
Este repositório tem o app mobile e os scripts SQL em `docs/backend/`.

Fora desta ADR: km rodado, trajeto, apps e PDF de corridas (Fase 2) estão na
[ADR-0002](0002-fase2-km-trajeto-corridas.md).

## 2. Decisões

| # | Decisão | Por quê |
|---|---|---|
| D1 | Autorização no banco: RLS em toda tabela, com políticas **RESTRICTIVE** e triggers por cima das permissivas | Vale para o app, o painel web e qualquer cliente futuro. O client nunca é a última barreira. |
| D2 | Resgate é **uma linha com máquina de estados** (`gerado → validado / expirado / cancelado`) protegida por trigger. Estorno é **evento novo** em `resgates_estornos` | É mais simples que event sourcing puro e continua auditável: os campos de auditoria são imutáveis e o estorno nunca edita o original. |
| D3 | A tarifa é congelada na validação (`tarifa_aplicada`, `plano_parceiro`). Os valores ficam em `tarifas_ativacao` | A fatura fica auditável linha a linha, e mudar de plano no meio do mês não recalcula nada. |
| D4 | Código `CC-XXXX` gerado por CSPRNG no servidor, **único só entre os abertos**, um aberto por (usuário, oferta) | O espaço de 32⁴ ≈ 1M códigos não se esgota, e duplo toque ou retry cai no índice único (23505). |
| D5 | Validação **só** por `rpc('validar_resgate')`, com limite de 5 erros/min e 20/h e log de toda tentativa | O código sozinho não valida: precisa ser do parceiro, de oferta ativa e estar dentro de 15 min no relógio do servidor. |
| D6 | Carteirinha com token opaco: gira a cada 60 s e vale 90 s no banco. Cache offline por no máximo 7 dias | Print de tela não serve como prova, e o cache vencido não aparenta estar ativo. |
| D7 | Excluir a conta significa **anonimizar**, nunca apagar. Só a Edge Function (`service_role`) faz isso | Atende LGPD art. 16 e mantém a trilha de cobrança. |
| D8 | Multi-tenant por `associacao_id`. O catálogo de parceiros/ofertas é **compartilhado** (sem `associacao_id`) | Hoje existe uma associação só. Ver limitação **L1**: essa decisão precisa ser revista antes da 2ª associação. |

### Alternativas consideradas

- **Event sourcing puro em resgates** (só INSERT, estado derivado). Rejeitado agora:
  dobra a complexidade das consultas do app e do painel. O meio-termo é a **M18**:
  um log de transições append-only ao lado da linha.
- **Token da carteirinha assinado (HMAC), sem gravar no banco.** Fica para depois
  (ver **G1**). O modelo atual funciona e já foi auditado.
- **Realtime no lugar de polling.** Fica para depois (ver **G5**). Backoff no polling
  resolve com menos peças.

## 3. Aderência às regras dos documentos

✅ implementado · ⚠️ parcial / precisa de ajuste · ❌ não existe · ⏳ depende de decisão externa

| Regra (doc) | Status | Onde / observação |
|---|---|---|
| RLS em toda tabela | ⚠️ | Nas tabelas tocadas, sim. A consulta de auditoria (`seguranca-fase1.sql`, seção 0) é manual e não roda no CI. |
| `service_role` só em Edge Function | ✅ | Nenhuma ocorrência em `src/`. |
| Papéis via `papeis_usuario` (multi-role) | ✅ | Seção 2: ninguém se promove. |
| Isolamento por `associacao_id` | ⚠️ | Ofertas exclusivas não checam **qual** associação (**L1**). |
| Token rotativo de 60 s | ✅ | `src/features/carteira/api.ts` (`INTERVALO_TOKEN_MS`). Vale 90 s no banco. |
| 15 min no relógio do servidor | ✅ | Trigger + `validar_resgate`. |
| Mesmo código se reabrir a oferta | ✅ | Índice `corre_resgates_um_aberto`. |
| CSPRNG, não sequencial | ✅ | `corre_gerar_codigo()`. |
| Limite de tentativas no balcão | ⚠️ | O limite é por **login** do parceiro, não por parceiro (**L5**). Alerta ao admin: ❌. |
| Log de toda tentativa | ✅ | `tentativas_validacao`. |
| Estorno com janela e motivo, append-only | ✅ | Janela = mesmo dia (falta confirmar com o negócio). |
| Fatura só de `validado`, com a tarifa gravada | ⚠️ | A view `cobranca_ativacoes` é calculada a cada leitura, sem fechamento imutável (**G9**). |
| Carência de 7 dias do inadimplente | ❌⏳ | Precisa de `associados.inadimplente_desde`. O app libera `inadimplente`, mas o banco bloqueia: o usuário vê uma mensagem genérica. |
| Cache offline de no máximo 7 dias | ✅ | `DIAS_MAX_CACHE`. O CPF fica em texto puro no AsyncStorage (**L8**). |
| `validade_carteirinha` derivada do pagamento | ❌⏳ | Depende do gateway (**L3**). |
| CPF obrigatório e validado | ✅ | Na filiação (`cpfValido`). Falta decidir se vale para quem já tem carteirinha. |
| Conta sem bloqueio; vínculo só depois da aprovação | ✅ | |
| `uf` sem valor fixo no código | ⚠️ | `FiliacaoScreen.tsx:83` usa `useState('GO')` como padrão (**L9**). |
| Senha com mínimo de 8 | ✅ | `SENHA_MINIMA = 8`. |
| Nome com 2 palavras é aviso, não bloqueio | ⚠️ | Funciona assim no cadastro, mas a filiação **bloqueia** (`FiliacaoScreen.tsx:46`). |
| Confirmar e-mail não trava o app | ⚠️ | Depende da opção "Confirm email" do Supabase. O app trata `precisaConfirmar`. **Conferir no painel.** |
| OTP por SMS | ❌ | Não começou (**L6**). |
| Exclusão anonimiza | ✅ | `corre_anonimizar_usuario`. Retenção de 5 anos ainda sem confirmação jurídica. |
| Idempotência por constraint | ⚠️ | Resgate: sim. Filiação: sem índice único de pendente (**L10**). |
| Rate limit em 3 camadas | ⚠️ | Usuário: ✅ (5 códigos/min). Parceiro: ⚠️. IP/dispositivo: ❌, só o nativo do Supabase Auth. |
| Observabilidade de fraude | ❌ | O dado existe, mas não há alerta, painel nem crash reporting no app (**L7**). |

## 4. Pontos limitantes

**L1 — Catálogo compartilhado vaza benefício entre associações.**
`seguranca-fase1.sql:310-313` libera oferta `exclusivo_associados` para quem é associado
ativo de **qualquer** associação. Com a 2ª associação, um associado da B resgata a
exclusiva da A. É preciso decidir entre ofertas globais e ofertas por associação
(tabela N:N `ofertas_associacoes`) **antes** do segundo tenant.

**L2 — Backend fora do versionamento.**
O SQL fica em `docs/backend/` e é aplicado à mão, sem migrations no repositório do banco e
sem CI. O próprio script registra o drift: o `resgates_preparar_insert` citado no app
"nunca foi aplicado". Em escala, isso vira bug intermitente entre staging e produção.

**L3 — Gateway de pagamento indefinido (Asaas ou Mercado Pago).**
Bloqueia `validade_carteirinha` derivada, a carência do inadimplente, a mensalidade e a regra
de "saldo lido da instituição de pagamento". É a dependência externa que mais trava funcionalidades.

**L4 — Painel Parceiro (web) depende de migração cruzada.**
O checklist da seção 8 ainda está aberto: `[ ] Painel Parceiro migrado de UPDATE direto
para rpc('validar_resgate')`. Se as travas estiverem aplicadas, a validação no painel
quebra (a política 3h bloqueia UPDATE do parceiro). Se não estiverem, o limite de
tentativas pode ser contornado. **Confirmar o estado real em produção.**

**L5 — O limite de validação é por login, não por parceiro.**
`validar_resgate` conta erros por `usuario_id`. Um parceiro com N logins tem N × 5
tentativas/min. Contar também por `parceiro_id`.

**L6 — Autenticação só com e-mail e senha.**
O público usa pouco o e-mail, e o telefone já é obrigatório. Sem OTP por SMS, a senha
carrega toda a proteção contra credential stuffing. O OTP tem custo por envio, recorrente.

**L7 — Sem observabilidade.**
Não há crash reporting nem APM no app (`package.json`), e `tentativas_validacao` não gera
alerta. Fraude e erro em produção ficam invisíveis até alguém reclamar.

**L8 — CPF em texto puro no cache offline.**
`salvarCache` (`carteira/api.ts:136`) grava a carteirinha inteira, com CPF, no AsyncStorage.
`allowBackup="false"` já reduz a exposição, mas em aparelho com root o dado continua legível.
O doc pede "dado sensível nunca em texto puro".

**L9 — `uf` 'GO' como padrão no código.**
`FiliacaoScreen.tsx:83`. A `associacoes.uf` já vem em `listarAssociacoesAtivas()`, então
dá para derivar dela.

**L10 — Filiação sem idempotência no banco.**
Não existe índice único (`usuario_id`, `associacao_id`) para pedido `pendente`. A aprovação
já fecha pedidos duplicados, mas a fila do admin cresce com toque duplo e retry.

**L11 — Transições de status sem histórico.**
Expirar, cancelar e validar são UPDATE na mesma linha: não fica registrado quem cancelou nem
quando expirou. O doc pede append-only para tudo que é financeiro. A aderência é parcial (D2).

## 5. Gargalos (o que quebra primeiro com volume)

Os números são estimativas para dimensionar o problema, não medições.

**G1 — Token da carteirinha grava no banco a cada minuto.**
Cada carteirinha aberta faz 1 INSERT e 1 DELETE por minuto (`seguranca-fase1.sql:737-741`).
50 mil telas abertas ao mesmo tempo dão cerca de 830 escritas/s, mais WAL e bloat. O DELETE
só limpa tokens do **mesmo** associado, então quem para de usar deixa tokens órfãos para sempre.
→ Agora: job no `pg_cron` que apaga os vencidos. Depois: token HMAC sem estado (M17).

**G2 — Lock por oferta em todo resgate.**
`pg_advisory_xact_lock(hashtext(oferta_id))` (`seguranca-fase1.sql:325`) serializa a geração
de código de **toda** oferta, mesmo sem limite configurado. Uma oferta divulgada por push
para 100 mil pessoas vira uma fila serial, com 3 `count(*)` por transação.
→ Travar só quando `limite_total` não for nulo. Para o limite por usuário, travar por
(oferta, usuário).

**G3 — `count(*)` em `resgates` sem índice declarado.**
O rate limit filtra `(usuario_id, gerado_em)` e os limites filtram `(oferta_id, status)`.
Nenhum script cria esses índices, e `resgates` é a tabela que mais cresce, porque nunca é apagada.
→ `create index concurrently` nos dois (conferir antes se já existem no banco).

**G4 — Códigos órfãos em `gerado`.**
A expiração é preguiçosa: só acontece quando a mesma pessoa reabre a mesma oferta
(`seguranca-fase1.sql:335`). Esses códigos continuam ocupando o índice único
`corre_resgates_codigo_aberto`. A chance de colisão por insert é de aproximadamente
abertos ÷ 1.048.576: com 100 mil órfãos, cerca de 10% dos inserts colidem. O app tenta 3 vezes
(`clube/api.ts:449`) e depois falha. O funil "gerado vs. expirado" também fica errado.
→ `pg_cron` a cada minuto: `update resgates set status='expirado' where status='gerado' and gerado_em < now() - interval '15 minutes'`.

**G5 — Polling de 5 s na tela de resgate.**
`ResgateScreen.tsx:48` faz até 180 requisições por resgate (15 min). 10 mil resgates abertos
dão cerca de 2 mil req/s só de polling.
→ Backoff (5 s → 15 s → 30 s) e nova leitura ao voltar para o app (`AppState`).
Realtime só se o backoff não bastar.

**G6 — Criar um resgate custa 5 a 6 idas e voltas ao servidor.**
`criarResgate` (`clube/api.ts:347`) busca oferta, resgate aberto, plano, associado, contagem
e só então faz o insert. No 4G ruim do entregador, isso é lento. As regras também ficam
duplicadas no client e saem do ar, como já mostra o caso do inadimplente.
→ Uma RPC `gerar_resgate(oferta_id)` que devolve `{ok, resgate_id | motivo}`.

**G7 — Número da carteirinha com `max()+1` e regex na tabela inteira.**
`6-aprovacao-filiacao-mobile.sql:74-77`, sob lock por associação: cada aprovação faz um scan
completo, e aprovar 1.000 em lote significa 1.000 scans seguidos.
→ Sequence (ou tabela contador) por associação.

**G8 — Aprovação humana da ASSEMAG (gargalo de negócio).**
A filiação depende de uma pessoa aprovar, sem SLA. É o freio mais provável da meta de
associados.
→ SLA (sugestão de 48 h úteis), fila ordenada por antiguidade, aprovação em lote,
pré-checagens automáticas (CPF, duplicidade) e push para o entregador quando for aprovado.

**G9 — A fatura é recalculada a cada leitura.**
`cobranca_ativacoes` agrega `resgates` inteiro a cada consulta e não tem fechamento.
→ Snapshot imutável no dia 1º (tabela `faturas`, só INSERT) e índice `(status, validado_em)`.

**G10 — Funções de RLS avaliadas linha a linha.**
`corre_tem_papel('admin_trakto')` e `auth.uid()` dentro das políticas rodam para cada linha.
Em listagens de admin com milhares de linhas, isso pesa.
→ Embrulhar em `(select ...)`, que o Postgres avalia uma vez por consulta (prática
recomendada pelo Supabase). Para `corre_parceiro_de(parceiro_id)`, trocar por
`parceiro_id in (select parceiro_id from papeis_usuario where usuario_id = (select auth.uid()))`.

## 6. Melhorias priorizadas

**P0 — antes de abrir volume (marketing, push em massa)**

| # | Melhoria | Resolve | Esforço |
|---|---|---|---|
| M1 | `pg_cron`: expirar resgates e limpar `tokens_carteirinha` | G1, G4 | P |
| M2 | Índices em `resgates` (`usuario_id, gerado_em`) e (`oferta_id, status`) | G3 | P |
| M3 | Lock condicional no trigger de resgate | G2 | P |
| M4 | Painel Parceiro usando `rpc('validar_resgate')` + alerta de `bloqueado` | L4, L7 | M |
| M5 | Mascarar o CPF antes de gravar o cache offline (só os últimos dígitos) | L8 | P |
| M6 | `uf` vinda da associação; nome com 2 palavras como aviso na filiação | L9, regra | P |
| M7 | Migrations versionadas + testes de `docs/backend/teste/` rodando no CI | L2 | M |
| M8 | Conferir no painel Supabase: "Confirm email" e limites do Auth | regra, L6 | P |

**P1 — antes de 100 mil usuários ou da 2ª associação**

| # | Melhoria | Resolve | Esforço |
|---|---|---|---|
| M9 | RPC `gerar_resgate(oferta_id)` única | G6 | M |
| M10 | Backoff no polling do resgate | G5 | P |
| M11 | Ofertas exclusivas por associação (`ofertas_associacoes`) | L1 | M |
| M12 | Funções de RLS embrulhadas em `(select ...)` | G10 | P |
| M13 | Fatura do mês como snapshot imutável | G9 | M |
| M14 | Sequence do número da carteirinha por associação | G7 | P |
| M15 | Crash reporting no app + painel de fraude a partir de `tentativas_validacao` | L7 | M |
| M16 | Limite de validação por `parceiro_id`; índice único de filiação pendente | L5, L10 | P |

**P2 — evolução**

| # | Melhoria | Resolve |
|---|---|---|
| M17 | Token da carteirinha HMAC sem estado (verificação checa assinatura + status atual) | G1 |
| M18 | `resgates_eventos`: log append-only de transições via trigger `AFTER UPDATE` | L11 |
| M19 | OTP por SMS como login principal | L6 |
| M20 | Gateway escolhido → validade derivada, carência e mensalidade | L3 |
| M21 | Ferramentas para a ASSEMAG: aprovação em lote, SLA visível, push de aprovação | G8 |

Esforço: P = horas, M = dias.

## 7. Consequências

**Positivas**
- A segurança não depende do client: app, painel web e integrações futuras herdam as travas.
- A cobrança é auditável linha a linha desde o dia 1.
- Os P0 são quase todos SQL de baixo risco, aplicáveis sem release do app.

**Negativas / custos**
- A lógica no banco (triggers, RPCs) exige migrations versionadas e testes SQL. Sem isso, o
  drift volta (L2).
- O catálogo compartilhado (D8) vai exigir migração de dados quando a 2ª associação entrar.
- OTP por SMS e o gateway trazem custo recorrente por usuário.

## 8. Decisões de negócio em aberto

| Decisão | Sugestão | Quem decide |
|---|---|---|
| Carência do inadimplente | 7 dias | ASSEMAG + Léo |
| SLA de aprovação de filiação | 48 h úteis | ASSEMAG |
| CPF obrigatório também para quem já tem carteirinha? | Marcar como "pendente de documentação" | ASSEMAG + Léo |
| Retenção dos resgates anonimizados | 5 anos (falta confirmação jurídica) | Contador/advogado |
| Janela de estorno | Mesmo dia (já implementado assim) | Chris |
| Mapeamento plano → tarifa (`gratuito` = R$1,50; `destaque`/`premium` = R$1,00) | Suposição atual no SQL | Chris |
| **Nova:** oferta exclusiva é global ou por associação? | Por associação | Léo |
| **Nova:** gateway Asaas ou Mercado Pago | — | Léo |
| **Nova:** orçamento de OTP por SMS | — | Léo |

## 9. Status de implementação (15/11/2026)

| # | Situação | Onde |
|---|---|---|
| M1 | ✅ Funções `corre_expirar_resgates` e `corre_limpar_tokens_carteirinha` + jobs `pg_cron` (cada 1 min / 10 min). **Habilitar `pg_cron`** no Supabase antes de aplicar | `partes/9-escala.sql` |
| M2 | ✅ Índices `resgates (usuario_id, gerado_em)`, `(oferta_id, status)`, validados por data, `tentativas_validacao (parceiro_id, criado_em)`, `tokens_carteirinha (expira_em)` | parte 9 |
| M3 | ✅ Lock por usuário sempre e por oferta só com `limite_total` | parte 9 |
| M4 | ⏳ Painel web (outro repositório) | — |
| M5 | ✅ Cache offline guarda o CPF já mascarado (`***.982.247-**`) | `wallet/data/walletRepository.ts`, `shared/format.ts` |
| M6 | ✅ UF vem da associação escolhida (sem `'GO'` fixo); nome de uma palavra só é aviso na filiação | `wallet/ui/screens/MembershipRequestScreen.tsx` |
| M7 | ✅ CI no GitHub Actions: tsc, eslint, prettier, Jest e a suíte SQL completa (156 checagens) num Postgres 17. As migrations continuam sendo aplicadas à mão | `.github/workflows/ci.yml`, `teste/rodar.sh` |
| M8 | ⏳ Conferência manual no painel do Supabase | — |
| M9 | ⏳ RPC `gerar_resgate` única | — |
| M10 | ✅ Polling do resgate: 5 s nos 2 primeiros minutos, 15 s até 10 min, 30 s depois | `club/domain/redemption.ts` |
| M11 | ⏳ Ofertas por associação (depende da decisão do Léo) | — |
| M12 | ✅ Políticas de `resgates`, `usuarios`, `associados` e `solicitacoes_filiacao` com `(select auth.uid())` | parte 9 |
| M13 | ⏳ Fatura como snapshot imutável | — |
| M14 | ✅ Número da carteirinha por contador `carteirinha_sequencias`, sincronizado por trigger com qualquer insert (inclusive do painel web) | parte 9 |
| M15 | ⏳ Crash reporting (falta escolher ferramenta) | — |
| M16 | ✅ Limite de validação também por parceiro (10/min, 40/h) + índice único de filiação pendente; o app trata o duplicado como "já enviado" | parte 9, `walletRepository.ts` |

**Aplicado em produção (Lovable Cloud) em 17/11/2026**, nesta ordem: checagem
(`aplicar/1-checagem.sql`) → `pg_cron` → parte 8 → parte 9, cada parte em `begin … commit`
pelo SQL editor do Lovable. O enum `status_solicitacao` já aceitava `cancelada` e não havia
filiação pendente duplicada. A parte 9 pode ser reaplicada sem efeito colateral. O Lovable
Cloud não dá acesso direto ao banco: toda mudança de schema passa pelo SQL editor, com os
arquivos de `docs/backend/aplicar/`.
