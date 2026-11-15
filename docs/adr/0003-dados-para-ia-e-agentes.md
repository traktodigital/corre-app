# ADR-0003 — CORRE: estratégia de dados para IA e agentes

| | |
|---|---|
| **Status** | Proposto |
| **Data** | 2026-11-15 |
| **Decisores** | Léo, Diogo |
| **Relacionadas** | [ADR-0001](0001-fase1-seguranca-escala.md), [ADR-0002](0002-fase2-km-trajeto-corridas.md) |

## 1. Contexto

Para propor melhorias com IA e agentes, é preciso ter **dado coletado antes**. Os documentos
de escopo não falam de dados nem de IA, e o app hoje não registra eventos de uso: não há
analytics (ADR-0001 L7).

Modelo e agente se resolvem rápido depois. **O dado que não foi coletado não volta.** Cada
mês sem instrumentação é histórico perdido.

## 2. O que já existe vs. o que falta

| Dado | Existe? | Onde | Serve para |
|---|---|---|---|
| Funil de resgate (gerado → validado/expirado/cancelado, horário, parceiro, oferta, valor) | ✅ | `resgates` (nunca apagado) | Fraude, relatório do parceiro, recomendação |
| Tentativas de validação no balcão | ✅ | `tentativas_validacao` | Fraude |
| Perfil (cidade, uf, veículo, plano, data de cadastro) | ✅ | `usuarios` | Segmentação |
| Filiação (pedido, aprovação, tempo de resposta) | ✅ | `solicitacoes_filiacao`, `associados` | SLA da ASSEMAG, pré-checagem |
| Catálogo (parceiro, categoria, oferta, validade) | ✅ | `parceiros`, `ofertas` | Recomendação |
| **Oferta vista mas não aberta** (impressão) | ❌ | — | **Recomendação**: sem isso, não dá para aprender o que o usuário ignora |
| **Busca, filtro, tela aberta, tempo de uso** | ❌ | — | Engajamento, churn |
| **Uso da carteirinha / verificação no parceiro** | ❌ | Os tokens são apagados | Uso real do benefício |
| **Localização / km / turno** | ❌ | Fase 2 (ADR-0002) | Ganhos, demanda, "perto de você" |
| **Ganhos e apps em que roda** | ❌ | Fase 2 (PDF, autodeclarado) | Copiloto de ganhos |
| **Pagamento / inadimplência** | ❌ | Depende do gateway | Churn, inadimplência |
| **Conversas de suporte** | ❌ | — | Agente de atendimento |

## 3. Casos de uso de IA e o dado que cada um exige

| Caso | Dado necessário | Pronto hoje? | Abordagem inicial |
|---|---|---|---|
| **Pré-checagem de filiação** (CPF, duplicidade, dados inconsistentes) para a ASSEMAG | Solicitações + associados | ✅ | Regras + LLM para resumir. Ataca o gargalo G8 da ADR-0001 |
| **Antifraude de resgate** | Resgates + tentativas | ✅ | Regras e limiares (volume fora do padrão, horário, erros em sequência) |
| **Agente de relatório do parceiro** (funil, pico de horário, sugestão de oferta) | Resgates + catálogo | ✅ | SQL agregado + LLM narrando. Vira produto vendável ao parceiro |
| **Agente de atendimento** (carteirinha, filiação, benefícios) | Estatuto, FAQ, regras + histórico de suporte | ⚠️ | Base de conhecimento no prompt. O histórico começa a ser gravado agora |
| **Recomendação de ofertas** ("pra você", "perto de você") | Resgates + **impressões** + localização com o app aberto | ⚠️ | Heurística (popular por região/horário) até ter volume. ML depois |
| **Copiloto de ganhos** (melhor horário/região, ganho por km por app, custo da moto) | Turnos, km, ganhos, apps | ❌ | Depende da Fase 2 |
| **Mapa de demanda / zonas quentes** (ASSEMAG, futuro Corre Frete) | Trajetos agregados | ❌ | Depende da Fase 2 |
| **Churn e inadimplência** | Pagamento + engajamento | ❌ | Depende do gateway + eventos |

**Os três primeiros já dão para propor hoje, com os dados que existem.** Os outros dependem
da coleta abaixo.

## 4. Decisões

| # | Decisão | Por quê |
|---|---|---|
| D1 | **Instrumentar eventos de uso já, na Fase 1**, sem esperar a Fase 2 | É o dado mais barato e o que mais falta para recomendação e engajamento. |
| D2 | **Eventos vão para uma ferramenta de product analytics** (ex.: PostHog, que tem SDK de React Native), **não para o Postgres do app** | Volume de eventos (dezenas por usuário por dia) incha o banco transacional. É ferramenta pronta, não código próprio. |
| D3 | **Dicionário de eventos versionado** (`docs/dados/eventos.md`): nome, quando dispara, propriedades. Mínimo inicial: `oferta_vista`, `oferta_aberta`, `resgate_gerado`, `busca`, `filtro_categoria`, `carteirinha_aberta`, `filiacao_iniciada`, `filiacao_enviada` | Sem dicionário, cada dev manda um nome diferente e o dado vira lixo. |
| D4 | **Identificador pseudônimo nos eventos** (o `usuario_id` UUID). **Nunca** CPF, nome, telefone ou placa | LGPD e minimização: o dataset de IA não precisa de identidade civil. |
| D5 | **Consentimento separado por finalidade**: (a) funcionamento do app; (b) melhoria do serviço/IA; (c) localização em turno. Cada um pode ser revogado | A base legal fica limpa e a taxa de opt-in é medida. Sem (b), o evento não sai. |
| D6 | **Trajeto da Fase 2 em duas camadas**: o bruto **identificado** fica por pouco tempo (30–90 dias, como arquivo no Storage); o **agregado anonimizado** (contagem por célula de grade e hora, com mínimo de N entregadores por célula) é guardado por muito tempo | O mapa de demanda e a IA de região não precisam saber quem é a pessoa. Trajeto identificado revela casa e rotina. Corrige o G1 da ADR-0002. |
| D7 | **Histórico próprio do entregador** (km diário, ganhos declarados, turnos) é guardado enquanto a conta existir e apagado na exclusão | É o insumo do copiloto de ganhos daquela pessoa. |
| D8 | **Registrar a verificação da carteirinha** (data/hora, associação, resultado), sem dado pessoal | É o único sinal de uso real do benefício presencial. Hoje se perde quando o token é apagado. |
| D9 | **Gravar as conversas de suporte** (WhatsApp/canal atual) com consentimento, desde já | Sem histórico, o agente de atendimento nasce sem saber o que as pessoas perguntam. |
| D10 | **Regra primeiro, ML depois.** Cada caso de IA começa com uma heurística e uma métrica de base. Modelo só quando houver volume e a heurística tiver um teto medido | Com poucos usuários, não há como treinar modelo (cold start). A heurística já entrega valor e vira a régua do modelo. |
| D11 | **Sem data warehouse agora.** Análise com SQL nos agregados + arquivos (DuckDB lendo do Storage) | Só adotar warehouse (BigQuery etc.) quando consultas no bruto ficarem lentas ou caras. |

## 5. Pontos limitantes

- **L1 — Pouco volume no início.** No teste fechado e nos primeiros meses, há pouca gente: dá
  para fazer estatística descritiva, não modelo. Expectativa precisa estar alinhada com o Léo.
- **L2 — Amostra enviesada.** Só Goiás, só moto, só quem instalou o app. Não generaliza
  para outro estado ou categoria sem dado novo.
- **L3 — Dado autodeclarado é ruidoso.** PDF de corridas e apps em que roda (ADR-0002 D5–D6)
  podem estar errados ou ser editados. Modelos sobre isso herdam o erro.
- **L4 — Opt-in reduz a base.** Consentimento por finalidade (D5) significa que nem todo
  mundo entra no dataset. Medir a taxa.
- **L5 — Schema instável.** Backend fora do repositório (ADR-0001 L2) mais uma equipe externa
  na Fase 2: coluna renomeada sem aviso quebra séries históricas.

## 6. Gargalos

- **G1 — Eventos no Postgres.** 100 mil usuários × 50 eventos/dia = 5 milhões de linhas/dia
  no banco do app. → D2.
- **G2 — Custo de LLM por caso.** O agente de relatório para N parceiros/mês e o de
  atendimento por conversa têm custo variável. → Teto por caso, modelo barato por padrão,
  medir custo por execução.
- **G3 — Qualidade antes de quantidade.** Evento duplicado, sem dicionário ou sem
  identificador estável não serve para treinar. → D3, D4 e revisão do dicionário no code review.

## 7. Sequência

| Quando | O quê |
|---|---|
| **Agora (Fase 1)** | Consentimento por finalidade (D5) · eventos mínimos (D1–D4) · log de verificação da carteirinha (D8) · gravar suporte (D9) |
| **Agora, com dado existente** | Proposta dos 3 casos prontos: pré-checagem de filiação, antifraude por regra, agente de relatório do parceiro |
| **Fase 2** | Trajeto em duas camadas (D6) · histórico do entregador (D7) · "perto de você" com heurística |
| **Com 3–6 meses de dado** | Recomendação com ML · copiloto de ganhos · mapa de demanda |
| **Com gateway** | Churn e inadimplência |

## 8. Decisões de negócio em aberto

| Decisão | Quem |
|---|---|
| Ferramenta de analytics (PostHog cloud, PostHog self-hosted ou outra) e orçamento | Léo |
| Texto de consentimento por finalidade (D5) | Léo + jurídico |
| Pode vender o relatório/insight ao parceiro? Em qual plano? | Léo + Chris |
| Agregado anonimizado de trajeto pode ser compartilhado com ASSEMAG ou terceiros? | Léo + ASSEMAG + jurídico |
| Qual canal de suporte gravar e por quanto tempo | Léo |
