ja p# ADR-0000 — Linha de base: o que o CORRE faz hoje (15/11/2026)

| | |
|---|---|
| **Status** | Registro do estado atual (não é proposta) |
| **Data** | 2026-11-15 |
| **Versão do app** | 1.0.0 (Android) |
| **Fonte** | Código deste repositório (`src/`, `docs/backend/`), não apenas documentos |

## 1. Contexto

Este é o ponto de partida das ADRs 0001–0005: o que **já funciona**, o que existe **só no
banco** e o que **ainda não existe**. A Fase 1 foi entregue (cadastro, área do usuário,
carteirinha e clube de benefícios). A ADR-0005 muda a porta de entrada para a jornada do dia.

**Legenda:** ✅ no app · 🗄️ só no banco (falta app ou aplicar) · 🌐 em outro sistema (painel
web, fora deste repositório e não auditado aqui) · 🚧 planejado

## 2. Plataforma

| Item | Hoje |
|---|---|
| App | React Native 0.87 (New Architecture), React 19, TypeScript |
| Backend | Supabase (Auth, Postgres com RLS, Storage, Edge Functions). Projeto `goias-delivery-link`, compartilhado com o painel web |
| Navegação | 4 abas (**Início · Benefícios · Carteira · Perfil**) + telas de parceiro, oferta, resgate, filiação, editar perfil, histórico e admin de filiações. A aba "Entregas" está comentada, reservada para a Fase 2 |
| Distribuição | Android: teste fechado na Play, 2ª rodada (a 1ª teve a produção recusada; ver `docs/loja/teste-fechado.md`). iOS: aguardando a conta Apple Developer |
| Testes | App: 30 casos em Jest (`__tests__/`). Banco: 104 checagens de segurança + 35 da jornada (`docs/backend/teste/`) |

## 3. Funcionalidades

### 3.1 Acesso e conta

| Funcionalidade | Status | Detalhe |
|---|---|---|
| Boas-vindas, login com e-mail e senha | ✅ | `WelcomeScreen`, `LoginScreen` |
| Cadastro | ✅ | Nome, e-mail, telefone (obrigatório), cidade, veículo, senha com no mínimo 8 caracteres. Nome de uma palavra só gera aviso, não bloqueia |
| Confirmação de e-mail | ✅ | Tela `ConfirmEmail`. Só bloqueia se a opção estiver ligada no Supabase (conferir, ADR-0001 M8) |
| Modo visitante | ✅ | "Explorar sem cadastro": navega pelo catálogo, e o login só é exigido no resgate |
| Sessão persistente | ✅ | Renovação automática do token com o app aberto |
| Perfil: ver e editar dados | ✅ | `profile/screen.tsx`, `EditarPerfilScreen` + link da política de privacidade |
| Sair | ✅ | |
| **Excluir minha conta** | ✅ | Anonimiza (LGPD + exigência da Play). Os resgates ficam anonimizados para auditoria |

### 3.2 Início

| Funcionalidade | Status | Detalhe |
|---|---|---|
| Saudação + economia do mês | ✅ | Soma do valor economizado nos resgates do mês |
| Ofertas em destaque | ✅ | Bloco "Ofertas chegando" |
| Card "Pedidos de filiação" | ✅ | Só para quem é admin da associação |
| Nível (Bronze/Prata/Ouro), "Perto de você", "Próximo evento", Formação/Casa própria | 🚧 | Marcados como TODO no código. Dependem de regra de produto, geolocalização ou parceria |

### 3.3 Clube de benefícios

| Funcionalidade | Status | Detalhe |
|---|---|---|
| Categorias e parceiros | ✅ | Lista de parceiros paginada |
| Parceiro e ofertas | ✅ | Regras da oferta: exclusiva para associado, exclusiva para premium, limite por usuário, limite total, período de validade |
| **Resgate** | ✅ | Código `CC-XXXX` + QR gerados pelo servidor (CSPRNG), válidos por 15 min no relógio do servidor. Reabrir a oferta devolve o mesmo código. O status se atualiza sozinho e a mensagem de recusa vem do banco |
| Histórico de resgates | ✅ | `HistoricoScreen` |
| Validação no balcão | 🌐 | É feita pelo parceiro no painel web, não no app. Falta confirmar se o painel já usa `validar_resgate` (ADR-0001 L4) |
| Estorno pelo parceiro, fatura mensal | 🗄️🌐 | Função `estornar_resgate` (mesmo dia, motivo obrigatório) e view `cobranca_ativacoes`. A tela fica no painel web |

### 3.4 Carteira (ASSEMAG)

| Funcionalidade | Status | Detalhe |
|---|---|---|
| Pedido de filiação | ✅ | Associação, nome completo, CPF validado, telefone, cidade, UF, veículo, placa, aceite do estatuto. Mostra o status do pedido |
| Carteirinha digital | ✅ | Com a marca da associação (cores e logo), número sequencial, selo de status (ativo, inadimplente, suspenso, desligado) e validade |
| **QR rotativo** | ✅ | Token opaco novo a cada 60 s (vale 90 s). Print de tela não serve |
| Verificação pública do QR | 🌐 | Página `/verificar/:token` no site. Mostra nome, foto, status e associação, nunca o CPF |
| **Modo offline** | ✅ | Abre sem internet com os dados salvos, mostrando a última sincronização. Depois de 7 dias sem sincronizar, a carteirinha some |

### 3.5 Administração (no app)

| Funcionalidade | Status | Detalhe |
|---|---|---|
| Aprovar e rejeitar filiação | ✅ | Para admin da associação: lista os pedidos pendentes das associações que administra. Aprovar é transacional (cria associado, número da carteirinha e papel); rejeitar exige motivo |
| Gestão de parceiros, ofertas, associados e pagamentos | 🌐 | Painel web |

### 3.6 Segurança no banco (vale para app e painel)

✅ Aplicado nos scripts de `docs/backend/` (falta confirmar o estado em produção):

- RLS com políticas restritivas; papéis em `papeis_usuario`, e ninguém consegue se promover.
- Resgate com máquina de estados protegida, campos de auditoria imutáveis e nunca apagado.
- Tarifa do parceiro gravada no momento da validação.
- Validação no balcão com limite de tentativas (5 por minuto / 20 por hora) e registro de toda tentativa.
- Plano e status do usuário e do parceiro só mudam pelo admin.
- Entregador não cria a própria carteirinha.

## 4. Feito hoje, ainda não no ar

| Item | Status |
|---|---|
| Banco da **Jornada do dia** (`partes/8-jornada.sql`): jornadas, ganhos por app, abastecimentos, resumo calculado, fotos no Storage, exclusão de conta | 🗄️ Testado (35/35). **Falta aplicar no Supabase** e construir as telas |
| ADRs 0001–0005 | Propostas e decisões registradas |

## 5. O que ainda não existe

| Item | Onde está planejado |
|---|---|
| Jornada no app (iniciar/encerrar, ganhos, abastecimento com foto, resumo) | ADR-0005, fase B |
| GPS em segundo plano + notificação do turno / Dynamic Island | ADR-0005 C, ADR-0002 D10 |
| Agente **Seu Ligeirin** (ler fotos, resumo, chat) no Archon | ADR-0005 D/E |
| Apps em que roda, PDF de corridas, dashboard comparativo | ADR-0002 |
| Analytics de uso, consentimento por finalidade | ADR-0003 |
| Biometria e sessão no Keychain/Keystore | ADR-0004 |
| Login por SMS (OTP) | ADR-0001 M19 |
| Gateway de pagamento, mensalidade, carência do inadimplente, validade automática | ADR-0001 L3 (falta decidir entre Asaas e Mercado Pago) |
| Alertas e painel de fraude, crash reporting | ADR-0001 L7 |
| Expiração automática de códigos e limpeza de tokens (`pg_cron`) | ADR-0001 M1 |

## 6. Consequências

- Esta é a régua para medir o que muda: cada nova ADR diz o que acrescenta ou altera em
  relação a esta.
- O que está marcado com 🌐 fica fora deste repositório e precisa de auditoria própria
  (painel web e site de verificação).
- Atualizar este arquivo a cada release, ou substituí-lo por uma ADR-0000 nova com data.
