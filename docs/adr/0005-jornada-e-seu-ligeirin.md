# ADR-0005 — Pivot: Jornada do dia como entrada do app + agente "Seu Ligeirin"

| | |
|---|---|
| **Status** | Aceito (direção do Léo, 15/11/2026). Fases B–E em andamento |
| **Data** | 2026-11-15 |
| **Decisores** | Léo, Diogo |
| **Relacionadas** | [ADR-0002](0002-fase2-km-trajeto-corridas.md) (km/trajeto), [ADR-0003](0003-dados-para-ia-e-agentes.md) (dados/IA), ADR-0001 da Plataforma de Agentes (Archon) |

## 1. Contexto

Ainda não há parceiros suficientes para o Clube de Benefícios funcionar sozinho. O Léo
inverteu a ordem: **a jornada do dia vira a porta de entrada** e é ela que vai puxar o resto
do clube depois. O app abre com um botão para iniciar a jornada e acompanha:

- quanto o entregador rodou no dia (km);
- quanto abasteceu (com foto do cupom de abastecimento);
- em quais apps rodou e quanto ganhou em cada um;
- a comparação entre os apps ("quem está pagando melhor"), com os dados guardados para análise.

Junto vem o **Seu Ligeirin**, um agente de IA que lê as fotos (cupom e odômetro), faz o
resumo do dia e responde dúvidas no chat do app.

Na prática, isso adianta para agora a Fase 2 da ADR-0002 e a coleta de dados da ADR-0003.

## 2. Decisões (respostas do Diogo em 15/11)

| # | Decisão |
|---|---|
| D1 | O km vem do **GPS em segundo plano** durante a jornada. A **foto do odômetro** no início e no fim serve de conferência e de reserva quando o GPS tiver buraco (ADR-0002 L2/L9) |
| D2 | O Ligeirin v1 faz três coisas: **lê fotos** (cupom e odômetro), **resume o dia** e **conversa no chat do app** |
| D3 | O agente **roda no Archon**: o CORRE vira um tenant e o Ligeirin é um *profile* com ferramentas próprias |
| D4 | O ganho por app é **digitado ao encerrar a jornada** |
| D5 | **A conta é do banco, não do LLM.** O resumo (km, gasto, ganho por app, custo/km, ganho/km, ganho/hora) sai de uma RPC SQL determinística, e o Ligeirin só narra (mesmo princípio da conciliação na Plataforma de Agentes) |
| D6 | **A IA não grava sozinha.** O que ela lê na foto volta para o app como sugestão, o entregador confere e corrige, e só então o app grava |
| D7 | **O app nunca fala direto com o Archon.** Uma Edge Function `ligeirin` valida o JWT do Supabase e chama o Archon com a chave do tenant (ver 3.2) |
| D8 | **O Archon não recebe `service_role`.** As ferramentas do Ligeirin leem o Supabase com o **token do próprio usuário** (repassado pelo proxy e válido por cerca de 1 h), então a RLS garante que ele só vê os dados daquela pessoa |

## 3. Arquitetura

### 3.1 Dados (Supabase, fonte da verdade)

```
apps_entrega(id text pk, nome)                    -- ifood, 99food, uber, rappi, lalamove, loggi, outro
jornadas(id, usuario_id, iniciada_em, encerrada_em, status em_andamento|encerrada,
         km_gps, odometro_inicio, odometro_fim, trajeto_path, suspeita bool)
         unique (usuario_id) where status = 'em_andamento'   -- uma jornada aberta por vez
jornada_ganhos(id, jornada_id, usuario_id, app_id, valor, corridas)  unique (jornada_id, app_id)
abastecimentos(id, usuario_id, jornada_id?, abastecido_em, litros, valor_total,
               preco_litro, posto, foto_path, origem foto_ia|digitado)
storage: bucket privado `jornada-fotos/<usuario_id>/...`
rpc resumo_jornada(jornada_id) / resumo_periodo(inicio, fim) -> km, gasto, ganhos por app, custo_km, ganho_km, ganho_hora
```

Regras herdadas da ADR-0001:
- RLS só para o dono.
- Idempotência por constraint.
- Exclusão de conta **apaga** jornadas, ganhos, abastecimentos e fotos, porque não são
  dados fiscais (ADR-0002 L6).

### 3.2 Fluxo com o Archon

```
App ──(JWT Supabase)──► Edge Function `ligeirin` ──(chave tenant CORRE + token do usuário)──► Archon
                            │ valida JWT, rate limit, gera signed URL da foto                │ profile "Seu Ligeirin"
                            ▼                                                                ▼
                         Supabase ◄──────── ferramentas read-only (RPC com o token do usuário, RLS)
```

Ferramentas do profile (todas só leitura):
- `resumo_jornada`
- `resumo_periodo`
- `comparar_apps`
- `listar_abastecimentos`
- `ler_foto(signed_url, tipo)`: modelo de visão que devolve JSON com litros, valor, preço por
  litro, posto, data ou km.

**Atenção:** o token do usuário **não pode ficar gravado** no `agent_trail` nem nos logs do
Archon. É preciso mascarar antes de persistir.

### 3.3 App

- A **aba inicial vira "Jornada"**: botão *Iniciar jornada*, km e tempo ao vivo, botão de
  *abastecimento* (foto) e *Encerrar*. O Clube vai para a segunda aba.
- Ao encerrar, aparecem os apps em que rodou, com o valor ganho em cada um, a foto do
  odômetro e o resumo do dia narrado pelo Ligeirin.
- O chat do Ligeirin fica numa tela própria.
- GPS em segundo plano com notificação fixa do turno (ADR-0002 D1/D10).

## 4. Fases

| Fase | Entrega | Depende de |
|---|---|---|
| **A** | SQL `docs/backend/partes/8-jornada.sql` (tabelas, RLS, RPCs de resumo, bucket) + testes no stub | — |
| **B** | App: **aba Entregas** (primeira aba, abre por padrão): iniciar (apps + foto do painel + combustível + odômetro + tanque, GPS liga sozinho), durante (km ao vivo, *Registrar abastecimento* com 3 fotos e insistência no cupom), encerrar (painel + ganho e comprovante de cada app, antes do resumo), resumo rodou · gastou · fez · sobrou. **Código pronto** em `src/features/trip/` (ADR-0009). Os valores são **digitados** na v1; o Ligeirin passa a ler as fotos na fase E. Falta: aplicar a parte 8 no Supabase e testar em aparelho | A |
| **C** | GPS em segundo plano. **Decidido: módulo nativo próprio, sem lib paga.** O código está pronto: Android em `android/.../trip/` (`TripTrackerService`) (foreground service `location`, notificação com km + cronômetro, *Live Update* no Android 16); iOS em `ios/CorreApp/Trip/` ("Durante o uso" + background `location`) com Live Activity e Dynamic Island em `ios/CorreTripWidget/` (falta o passo no Xcode, ver `README.md`); ponte JS em `src/core/device/location` + `src/core/permissions`. Falta testar em aparelho barato | B |
| **D** | Archon: tenant CORRE, profile Seu Ligeirin, ferramentas, leitura de foto + Edge Function `ligeirin` | A |
| **E** | App: chat do Ligeirin + leitura de foto ligada ao abastecimento e ao odômetro | B, D |

## 5. Riscos

- **GPS em segundo plano:** política das lojas, celulares baratos, iOS fechado não religa
  (ADR-0002 L1, L2, L9). O odômetro (D1) segura o km quando o GPS falha.
- **Dados pessoais entre dois sistemas** (CORRE ↔ Archon): é preciso declarar na política de
  privacidade e no consentimento de IA (ADR-0003 D5).
- **Custo de LLM por foto e por conversa:** limite por usuário/dia na Edge Function + o
  teto do plano do tenant no Archon.
- **Ganho digitado** é autodeclarado, então a comparação entre apps é indicativa (ADR-0002 L5).

## 6. Revisão 2 — requisitos do Léo (`CORRE_Rota_Copiloto_Ligeirin_DiogoDev`, 15/11)

### 6.1 O que muda nas decisões

| Antes | Agora | Por quê |
|---|---|---|
| D4: ganho por app **digitado** ao encerrar | No encerramento, o entregador **envia print ou PDF do comprovante de cada app**. O Ligeirin lê o valor, o entregador confere e confirma (D6). Digitar continua como reserva | O comprovante vira dado mais confiável para a inteligência coletiva (ADR-0002 §8) |
| A aba inicial se chama "Jornada" | A jornada fica na **aba "Entregas"** (a que está comentada em `TabBar.tsx:7`) | Pedido do Léo. Falta decidir se ela é a aba que abre por padrão |
| Odômetro como foto opcional | A **foto do painel** no início e no fim é obrigatória (odômetro + nível do tanque), com o tipo de combustível (gasolina/etanol) | O km "oficial" da inteligência coletiva vem do odômetro. O GPS mede o km do dia e serve de conferência |
| D8: o Archon lê com o **token do usuário** | **Escopo mínimo** (6.4) | Com o token do usuário, o agente veria tudo o que o usuário vê: CPF hoje, dado de saúde amanhã. O Léo exige separação técnica |

### 6.2 Fluxo da aba Entregas

1. **Iniciar:**
   - O GPS liga sozinho (`iniciarGps`, já pronto).
   - Duas perguntas obrigatórias: (1) em quais apps vai rodar (vários podem ser marcados);
     (2) foto do painel + gasolina/etanol.
2. **Durante o dia:**
   - O botão *Registrar abastecimento* fica sempre visível.
   - O abastecimento pede 3 fotos: cupom fiscal, painel com o odômetro e marcador depois de
     abastecer, mais o tipo de combustível.
   - Se o entregador tentar pular o cupom, o Ligeirin **insiste e explica o motivo**. Se ele
     pular mesmo assim, o abastecimento é gravado marcado `sem_cupom` e fica fora da média
     de preço.
3. **Encerrar:**
   - Antes de qualquer resumo, pede o comprovante (imagem ou PDF, vários arquivos) de cada
     app marcado e a foto do painel.
   - Depois mostra o resumo: **rodou · gastou · fez · sobrou** (`resumo_jornadas`, já testado).

### 6.3 Ajustes no schema (`partes/8-jornada.sql`, ainda não aplicado, então muda sem migração)

| Tabela | Ajuste |
|---|---|
| `apps_entrega` | Catálogo do Léo: `ifood`, `99`, `rappi`, `uber`, `shopee`, `mercadolivre`, `outro` (mantém `lalamove` e `loggi`) |
| `jornada_ganhos` | `valor` passa a aceitar nulo: a linha nasce **na abertura** (app marcado) e o valor chega no encerramento. Novos campos: `comprovantes text[]` (caminhos no Storage) e `origem` (`comprovante_ia` / `digitado`). "Rodou num app só" = 1 linha |
| `jornadas` | Novos campos: `combustivel` (`gasolina` / `etanol`), `foto_painel_inicio`, `foto_painel_fim`, `nivel_tanque_inicio` (%, lido da foto e confirmado) e `celula` (região aproximada, ~1 km, para a ADR-0002) |
| `abastecimentos` | `foto_path` vira `foto_cupom`, `foto_odometro` e `foto_marcador`. Novos campos: `combustivel`, `odometro`, `posto_cnpj`, `celula` e `sem_cupom` (gerado: `foto_cupom is null`) |
| Bucket `jornada-fotos` | Aceitar também PDF (comprovantes) |

**Melhoria sugerida:** o cupom de posto em Goiás é NFC-e e traz um **QR code** com a chave
de acesso. Ler o QR (determinístico) dá CNPJ, data e valor **sem OCR**. O LLM fica como
reserva para cupom amassado ou sem QR.

### 6.4 Seu Ligeirin: persona no prompt, regras no código

A persona (veterano de 55–60 anos, número primeiro, "rapaz" ou o nome, nunca "querida/moça",
humor seco só depois da informação, sem emoji, sem exclamação em série) vira o
**system prompt do profile no Archon**.

O que **não pode depender do LLM** fica em código determinístico, antes ou depois da chamada:

| Regra do Léo | Onde é aplicada |
|---|---|
| Nunca mente sobre o que é melhor. **Diferença acima de 10%: vence o 1º.** Dentro dos 10%, desempata pelo nível: diamante > master > ativo > vizinhança > parceiro | Função de ranking (pontuação por distância, preço e adequação), executada **antes** do LLM. O LLM só redige a frase |
| Registrar qual regra decidiu cada indicação | Tabela append-only `ligeirin_recomendacoes` (candidatos, notas, regra que decidiu) |
| Toda oferta vem com motivo explícito | O ranking devolve o motivo como dado. Sem motivo, a oferta não sai |
| No máximo 4 mensagens não solicitadas por dia, no máximo 2 com parceiro. Silêncio das 22h às 6h. Alerta de segurança fura tudo | Fila de envio com contador por usuário/dia (America/Sao_Paulo), registrado em `ligeirin_mensagens` |
| Categoria recusada 2 vezes some por 30 dias | `ligeirin_recusas` (usuário, categoria, data) |
| Sem emoji / exclamação em série; zero humor em segurança, acidente, dinheiro curto ou saúde | Validador da resposta (regex) + flag `modo_serio` nesses contextos |
| Número sempre vem de ferramenta (D5); quando não sabe, diz que não sabe | Ferramentas só de leitura. Resposta com número sem fonte é bloqueada |
| **Não vê dado de saúde** (separação técnica) | **D8 revisto:** o proxy `ligeirin` emite um JWT curto com a claim `escopo: ligeirin`. As tabelas sensíveis (saúde, CPF, documentos) ganham política **RESTRICTIVE** que nega esse escopo. O Ligeirin só chama RPCs de uma lista fechada |

### 6.5 Canais e lacunas novas

| Item | Situação |
|---|---|
| Ligeirin no app com **voz** (grátis) | A leitura em voz alta usa o TTS nativo do aparelho (offline, sem custo). A fala do entregador usa a transcrição que o Archon já tem. É requisito de acessibilidade (capacete e luva) |
| **WhatsApp ida e volta** só no plano Corre Seguro (R$ 9,90) | Canal WhatsApp do Archon + verificação do plano. **Resolvido (Léo, 15/11):** Corre Seguro é plano do **entregador** = `usuarios.plano` (`free` / `premium`). É outro eixo, não tem relação com `parceiros.plano`. **Decisão:** renomear o valor e o rótulo para `corre_seguro` / "Corre Seguro" quando o gateway entrar, para nunca confundir com o "premium" do parceiro. Hoje o app mostra "Plano premium" (`profile/screen.tsx:127`) e "só para quem tem o plano premium" (`clube/api.ts:316`) |
| **Notificações do Ligeirin** | ❌ **O app não tem push hoje.** Precisa de FCM (Android) + APNs (iOS): é uma peça nova |
| Níveis de parceiro (diamante… parceiro) | **Dois eixos (Léo, 15/11):** os 5 níveis são o **modelo de venda**; `parceiros.plano` (enum `gratuito` / `destaque` / `premium`, criado pelo painel web) é o **balde de tarifa**. **Proposta:** coluna nova `parceiros.nivel` (`parceiro` / `vizinhanca` / `ativo` / `master` / `diamante`), usada no desempate do Ligeirin e nos destaques, com a regra `nivel = 'parceiro'` ⇔ `plano = 'gratuito'` (porta sem mensalidade) e os outros 4 ⇔ `plano` pago. O `plano` continua sendo o que o painel e a tarifa usam. As flags de nível (presença na home, painel completo, território exclusivo) entram quando houver tela que as use. ⚠️ **Conflito de tarifa:** o Léo cita **5% por resgate** (sem mensalidade) e 0% (com mensalidade); o escopo da Fase 1, as regras e o banco (`tarifas_ativacao`) cobram **R$ 1,50 / R$ 1,00 fixos por ativação**. Porcentagem exige saber **o valor da compra** no balcão, coisa que o app não tem (oferta percentual grava `valor_economizado = null`), e o parceiro teria de digitar o valor na validação. Decidir qual modelo vale |
| "Posto X a dois quarteirões, você está com meio tanque" | Precisa da localização dos parceiros (PostGIS) + estimativa do tanque (nível da foto + km rodado ÷ consumo médio dos abastecimentos) |
| "Outros custos registrados no dia" (resumo *gastou*) | **Resolvido (Léo, 15/11):** era imprecisão do doc, porque não existe fluxo de captura. **v1: *gastou* = combustível.** Os custos de manutenção entram depois, pelo histórico do Minha Moto (ADR-0007), sem botão novo agora |

### 6.6 Áudios do Léo (15/11, 13h23–13h37)

| Pedido | Decisão técnica |
|---|---|
| "Seguir exatamente o documento" (a rev. 2 é a referência daqui para a frente) | §6.1–6.5 |
| **Prazo:** os entregadores começam a baixar e usar **na semana que vem**; lançamento oficial em **15/12**; "os dois estão liberados agora" | ⚠️ Confirmar se "os dois" são Android e iOS **publicados**. Se forem, o aviso sobre permissões de GPS (declaração na Play e revisão na Apple) vale **já na próxima versão** |
| **Voz do Ligeirin com ElevenLabs** (o Léo tem conta; a Coralina, da Vtria, usa). Voz provisória agora, e esta semana ele define uma **voz própria, clonada** (senhor, voz firme). A ferramenta fica a critério do Diogo, e o custo é estudado depois | (1) A chave da ElevenLabs fica **só no servidor** (Edge Function / Archon), nunca no app. (2) Áudio em streaming, com modelo de baixa latência. (3) **Cache** das frases fixas (avisos, tutorial) para não pagar de novo. (4) **Reserva:** TTS nativo do aparelho, offline, para quando estiver sem internet ou acabar a cota. (5) Clonar a voz de uma pessoa real exige **autorização por escrito** do dono da voz (cessão de uso) e a verificação de clone profissional da ElevenLabs. (6) Teto de caracteres por usuário/dia (custo) |
| **Apresentar o Seu Ligeirin:** imagem dele + **cards de tutorial** explicando cada ponto, com ilustrações da Thay. A tela de entrada vai mudar para focar no entregador e no copiloto, mas só depois: "cria toda a estrutura" agora | Construir agora a estrutura do onboarding (cards com espaço para imagem + texto + narração), com imagens provisórias. A tela de boas-vindas atual fica até as artes chegarem |
| **3B Indenizações:** página cativa + rota dentro do botão de emergência, montada a partir dos documentos que a 3B enviou ("esse fornecedor tem que estar vinculado ao botão de emergência") | ADR-0006 D8. ⚠️ **Faltam os arquivos da 3B** (não estão no computador do Diogo). Continua valendo: a rota só vai ao ar com o fluxo deles validado |
| **Pesquisar a "Lumie"** ("o FG liberou o uso da Lumie, um protocolo de LLM", mais barato em tokens, para análise de dados) | ⚠️ Nome incerto na transcrição. Confirmar com o Léo qual é o produto antes de pesquisar |

### 6.7 Percurso guiado: o Ligeirin conduz o dia (áudio de 12h35: "guiar o percurso dele")

A jornada não é um formulário. É um **roteiro com um único próximo passo na tela** em cada
momento, conduzido pelo Ligeirin (com voz).

| Momento | Próximo passo (um por vez) | Quem decide quando |
|---|---|---|
| Abertura | 1) Em quais apps vai rodar → 2) foto do painel + gasolina/etanol → 3) GPS liga e o turno aparece na notificação / Dynamic Island | Fluxo fixo do app |
| Durante | Cartão do Ligeirin com km e tempo + *Registrar abastecimento* sempre visível | — |
| Lembretes | Tanque estimado < 25% → "abastece"; jornada aberta há mais de 14 h → "esqueceu de encerrar?"; 15 min sem GPS → "o GPS parou, abre o CORRE" | **Gatilhos determinísticos** no código (limiares configuráveis). O LLM só redige a frase, e os lembretes respeitam o teto e o silêncio da §6.4 (segurança fura) |
| Ir até um lugar (posto, oficina, parceiro, escritório da 3B) | Botão "Ir até lá" | **Abre Waze ou Google Maps** por link. **Não** construir navegação própria: custa caro e distrai, e o entregador já usa esses apps |
| Encerramento | 1) Foto do painel → 2) comprovante de cada app marcado → 3) resumo narrado (rodou · gastou · fez · sobrou) | Fluxo fixo do app |

### 6.8 Cronograma até o lançamento (15/12, confirmado pelo Diogo; não é 17/11)

A Apple costuma pedir mais de uma rodada de revisão (escopo da Fase 1). Por isso a **versão
de loja congela em 05/12**, e 06–14/12 fica para revisão e correção. O que não couber entra
como atualização logo depois do lançamento.

| Semana | Entrega | ADR |
|---|---|---|
| **16–22/11** | Ajustes da parte 8 (§6.3) + aplicar no Supabase (staging → produção). **Aba Entregas** completa (iniciar → abastecer → encerrar → resumo) ligada ao GPS. Teste em aparelho barato. Declaração de localização na Play (vídeo) | 0005 B/C |
| **23–29/11** | **Seu Ligeirin v1** no Archon: proxy com escopo, leitura de fotos (QR da NFC-e + painel + comprovante), resumo narrado, chat. **Voz ElevenLabs** (provisória) + cache + reserva nativa. Regras determinísticas (teto, silêncio, motivo). Cards de apresentação (imagens provisórias). iOS: target da Dynamic Island no Xcode | 0005 D/E, §6.4–6.7 |
| **30/11–05/12** | **Botão de emergência** (SOS, 192/193, contato + localização) + **rota da 3B** (se o teste ponta a ponta e o consentimento estiverem aprovados). **Push** (FCM/APNs). Acesso parceiro (WebView). Consentimento por finalidade + analytics. P0 da ADR-0001 (`pg_cron`, índices, lock). **05/12: versão de loja congelada** | 0006, 0008, 0003, 0001 |
| **06–14/12** | Revisão das lojas e correções. Em paralelo: **Minha Moto v1** (ficha, km, manutenção por km, documentos com vencimento, consumo anômalo) | 0007 |
| **15/12** | Lançamento | — |
| Depois de 15/12 | Minha Moto na loja (atualização), pneu por foto, multas, inteligência coletiva **visível** (a coleta começa na semana 1; a tela só liga quando o piso de 20 registros / 10 entregadores for atingido) | 0007, 0002 §6b |

**Risco:** é uma pessoa só para tudo isso. O caminho crítico é aba Entregas → Ligeirin →
emergência. Minha Moto é o que escorrega primeiro.

**Regra de segurança:** com a moto em movimento (velocidade do GPS > ~10 km/h), o Ligeirin
**não pede nenhuma ação na tela**: só fala, e a pergunta espera ele parar. "Aviso só escrito
convida a ler em movimento" (doc do Léo §1).
