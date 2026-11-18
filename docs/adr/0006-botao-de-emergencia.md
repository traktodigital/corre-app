# ADR-0006 — Botão de emergência

| | |
|---|---|
| **Status** | **v1 entregue em 17/11/2026** (§5): SOS em todas as telas, 192/193, contato de emergência e registro. Ficam para depois: link ao vivo (D4), SMS pelo servidor (D5) e **a rota da 3B, bloqueada** até o teste ponta a ponta |
| **Data** | 2026-11-15 |
| **Fonte** | `CORRE_Rota_Copiloto_Ligeirin_DiogoDev` §5.1 |

## 1. Contexto

O botão fica sobreposto a todas as telas e é **grátis para todo entregador cadastrado**. É
acionado por pressão contínua de 3 s. Ao acionar, ele:
- envia a localização em tempo real e os dados do entregador;
- avisa o contato de emergência;
- muda o estado da tela até alguém responder.

As rotas são: ligar para os Bombeiros (193) e o SAMU (192), e abrir o canal de indenização da
3B (com aviso de que **não é seguro e não substitui 192/193**).

## 2. Decisões

| # | Decisão | Por quê |
|---|---|---|
| D1 | **Componente de sobreposição no `AppShell`**, acima do navegador e visível em todas as telas (inclusive para visitante cadastrado) | Uma implementação só, sem depender de cada tela |
| D2 | **Pressionar e segurar por 3 s** com anel de progresso + vibração. Soltar antes cancela. Alvo grande (≥ 64 pt), com rótulo para leitor de tela | Evita disparo acidental no bolso e funciona de luva |
| D3 | **192 e 193 abrem o discador** (`tel:`), não fazem a ligação direto | Ligar direto no Android exige `CALL_PHONE`, permissão sensível na Play. O discador funciona **sem internet** e é a rota mais confiável |
| D4 | **Localização ao vivo para o contato** por um **link público temporário** (`/emergencia/:token`, expira em 2 h ou quando o entregador encerra). O GPS (`TripTracker`, ADR-0009) roda em **modo emergência**, com intervalo menor | O contato não precisa ter o app. O token é opaco e expira, como a carteirinha |
| D5 | **O aviso ao contato** sai do servidor (Edge Function), por **SMS**. WhatsApp é opcional, via Archon, com template aprovado | SMS chega em qualquer celular. O WhatsApp Business exige template aprovado previamente |
| D6 | **Registro append-only** em `emergencias` e `emergencia_eventos` (acionou, enviou, contato abriu o link, cancelou, encerrou) | Auditoria e suporte. Nunca se edita |
| D7 | **Contato de emergência** cadastrado pelo próprio entregador (nome + telefone), com RLS só do dono. O Ligeirin **não lê** (escopo, ADR-0005 §6.4) | Dado pessoal de terceiro |
| D8 | **Rota da 3B só aparece depois de uma flag ligada pelo admin**, quando o fluxo deles estiver validado | Segurança jurídica, como pediu o Léo |
| D9 | **Modo teste** (para QA e para a revisão das lojas): simula o acionamento sem enviar SMS nem abrir o discador de verdade | Não dá para testar ligando para o 192 |

## 3. Pontos limitantes

- **L1:** sem internet não há localização ao vivo nem SMS. O discador do 192/193 funciona
  mesmo assim. A tela precisa deixar isso claro e nunca prometer o que não consegue cumprir.
- **L2:** com o celular bloqueado ou o app fechado, o botão não está na tela. Os próximos
  passos são o atalho na notificação da jornada (Android), um widget e o botão de ação do iPhone.
- **L3:** SMS tem custo por envio e depende de um provedor (falta escolher).
- **L4:** **dado de saúde** (tipo sanguíneo, alergias), se for coletado aqui, vai para uma
  tabela própria com **consentimento próprio e destacado** (ADR-0005 §6.4, doc do Léo §8),
  com política RESTRICTIVE que nega o escopo do Ligeirin.
- **L5:** é uma funcionalidade crítica: precisa de teste ponta a ponta em aparelho real antes
  de ir para qualquer loja, e de um texto revisado pelo jurídico.

## 3b. Fluxo da 3B Indenizações (documento "Informações", recebido em 15/11)

O fluxo **por escrito** já existe. Falta o **teste ponta a ponta** com a 3B para liberar o D8.

| Passo | Conteúdo (da 3B) | Decisão técnica |
|---|---|---|
| 1. Botão **"Sofri acidente"** | "Se você acabou de sofrer um acidente, chame o socorro: 193 / 192" + botões | Mesma tela do SOS (D3: abre o discador). Usar **ícone em vez do emoji** 🤕 (regra "sem emoji" do Léo) |
| 2. **"Saber meus direitos"** | Formulário **sem campo obrigatório**: data do acidente; estava trabalhando (sim/não); teve fratura (sim/não/não sei); app usado (Uber / 99 / iFood / Outro, vários) | Não é urgente, então **não** pede pressão de 3 s. Os apps vêm do catálogo `apps_entrega` |
| 3. **"Análise gratuita"** | Tela de consentimento LGPD: "Concordo e continuar" / "Cancelar" | Grava o consentimento (versão do texto + data/hora) em uma tabela append-only |
| 4. **WhatsApp da 3B** | Abre `wa.me/5562991797653` com a mensagem preenchida: nome, CPF, telefone, e-mail, data, em corrida, lesões, app | Quem envia é o **próprio entregador**, pelo WhatsApp dele. O app só preenche o texto. Antes de abrir, mostrar "atendimento seg–sex, 8h–18h, exceto feriados", a opção de **ligação normal** e o endereço |
| 5. **Relatório mensal** (dia 10) | A 3B cruza "quem clicou no botão de WhatsApp" com o RD CRM e as conversões. Contato: Samuel; financeiro: Pedro Henrique. A 3B **não tem TI própria** | Tabela append-only `leads_parceiros` (usuário, parceiro `3b`, data, versão do consentimento) + export CSV para o admin Trakto. Só entra quem **consentiu** |

**Página da 3B** (cativa): descritivo, depoimentos, endereço, site, Instagram, YouTube e TikTok
+ logos (`drive-download…`: completa e símbolo, nas versões colorida e branca).

### Pontos de atenção (LGPD)

- **"Teve fratura / lesões" é dado de saúde** (dado sensível, LGPD art. 11). O consentimento
  precisa ser **específico e destacado**, dizendo **quais dados** vão para a 3B (nome, CPF,
  telefone, e-mail, dados do acidente e **informação de lesão**) e **para quê**. O texto atual
  da 3B é genérico. **Proposta de texto** a validar com o jurídico:
  > "Ao tocar em Concordo e continuar, você autoriza a [razão social/CNPJ], pelo app Corre, a
  > enviar à 3B Indenizações seu nome, CPF, telefone, e-mail e as informações do acidente
  > (data, se estava trabalhando, se teve lesão e o app usado), para que ela analise
  > gratuitamente seus direitos e entre em contato. A Trakto também informa à 3B, uma vez
  > por mês, que você usou este canal. Você pode revogar quando quiser em Perfil →
  > Privacidade."
- O texto da 3B escreve **"Trackto Digital"**: corrigir para a razão social certa (Trakto ou
  a nova empresa CORRE).
- **Minimização:** o CPF vai na mensagem por pedido da 3B. Alternativa: só incluir se o
  entregador marcar "incluir meu CPF".
- **O relatório mensal é compartilhamento de dado com terceiro** e precisa estar coberto pelo
  consentimento (texto acima). Exportar só quem consentiu, com o mínimo de campos.
- As respostas do formulário **não** ficam visíveis para o Ligeirin (escopo, ADR-0005 §6.4).
- **Depoimentos com nome de pessoas reais:** a 3B garante que tem a autorização delas (pedir
  confirmação por escrito).

## 5. O que a v1 entregou (17/11/2026)

| Item | Como ficou |
|---|---|
| D1, D2 | `EmergencyButton` fora do navegador (o `App` passa a rota atual pelo `navigationRef`), em todas as telas logadas, menos nas próprias telas de emergência e com o teclado aberto. Segurar 3 s com anel de progresso (SVG) e vibração; soltar antes cancela. O leitor de tela aciona por ação de acessibilidade |
| D3 | 192 e 193 abrem o discador (`tel:`), sem `CALL_PHONE`. Validado no emulador: abre com o número, não liga |
| D5 (provisório) | **Sem provedor de SMS ainda**, o aviso sai do **próprio celular** do entregador: abre WhatsApp (`wa.me`) ou SMS com a mensagem pronta (nome, hora de Brasília e link do Maps). Ele só toca em enviar. Quando o provedor existir, o servidor passa a enviar sozinho (D5 original) |
| D4 (parcial) | A localização vai **uma vez** no aviso (última posição conhecida, `TripTracker.getLastLocation` no Android e iOS). O link ao vivo continua pendente |
| D6 | Uma tabela append-only `emergencia_eventos` (`acionou`, `ligou_192`, `ligou_193`, `avisou_contato`, `encerrou`), agrupada por `emergencia_id`, que nasce no `acionou`. O app registra **sem travar**: sem internet, o fluxo segue e o registro é perdido |
| D7 | `contatos_emergencia` (um por entregador), RLS só do dono, editado em Perfil → Contato de emergência |
| D9 | **Não precisou:** o app nunca liga nem envia sozinho, então testar não aciona o socorro de verdade |
| Banco | `partes/10-emergencia.sql` (redefine `corre_anonimizar_dados`: a exclusão de conta apaga contato e eventos). Teste: `teste/7-emergencia.sql` (22 checagens) |

### 5b. Rota da 3B construída atrás da flag (D8), desligada

| Item | Como ficou |
|---|---|
| Flag | `app_flags` (`rota_3b`, nasce **desligada**). Só o admin liga, no SQL editor: `update public.app_flags set ligada = true, atualizado_em = now() where chave = 'rota_3b';`. O app lê ao abrir a tela de emergência. **Sem versão nova na loja** |
| Trava no banco | Com a flag desligada, o banco **recusa** consentimento e lead da 3B, mesmo com o app alterado. Revogar é sempre permitido |
| Telas | Card "Sofri acidente" na tela do SOS (só com a flag) → **Sofri acidente** (193/192 + "Saber meus direitos") → **formulário** (nada obrigatório; apps Uber/99/iFood/Outro, como pediu a 3B, e não o catálogo inteiro) → **consentimento** ("Concordo e continuar" / "Cancelar") → **WhatsApp da 3B** com a mensagem no modelo deles, horário, endereço e "ligar" (ligação normal). Página **3B Indenizações** com a logo (cartão branco, para manter as cores), descrição, depoimentos, endereço e redes |
| Consentimento | O **texto fica no banco** (`textos_consentimento`, versionado, com histórico) e o app só exibe: o texto do jurídico entra **sem versão nova na loja**. `consentimentos` é append-only (`aceitou`/`revogou`), e **o banco grava a versão vigente**, não a que o app diz. Texto atual **provisório** (`3b-2026-11-17-provisorio`), com "Trakto Digital" no lugar de "Trackto". Sem o registro do consentimento, o app **não abre** o WhatsApp. Revogar fica em **Perfil** ("Parar de compartilhar meus dados com a 3B"), só para quem consentiu |
| Minimização | As respostas do formulário (data, lesão, app) **não vão para o banco**: só para a mensagem que o próprio entregador envia. O CPF só vai se ele marcar (começa em "Não") |
| Relatório do dia 10 | `leads_parceiros` (1 linha por toque em "Abrir WhatsApp da 3B", com a versão do consentimento). Export: `aplicar/8-relatorio-leads-3b.sql` (mês anterior: data, nome e telefone, só de quem **segue** consentindo) |
| Banco | `partes/11-rota-3b.sql`. Teste: `teste/8-rota-3b.sql` (26 checagens, com a flag desligada e ligada). Conferência: `aplicar/9-conferencia-parte-11.sql` |
| Validado no emulador | Com a flag forçada só no código local: card, as 4 telas, a logo e a recusa sem consentimento registrado. Com a flag real (desligada): o card não aparece |

**Para ligar a rota (nada disso exige versão nova do app):** (1) teste ponta a ponta com a 3B; (2) texto final do jurídico, publicado com `insert into public.textos_consentimento (finalidade, versao, texto) values ('3b_indenizacao', '3b-AAAA-MM-DD', '<texto>');`; (3) confirmação por escrito da autorização dos depoimentos. Depois, o `update` da flag acima.

## 4. Pendências

| Pendência | Quem |
|---|---|
| Provedor de SMS e orçamento | Léo |
| ~~Fluxo da 3B por escrito~~ (recebido em 15/11, §3b). Falta o **teste ponta a ponta** (mensagem de teste chega no WhatsApp e no RD CRM deles) | Léo + Samuel (3B) |
| Texto de consentimento específico (dado de saúde) + razão social certa | Jurídico |
| CPF sempre na mensagem ou opcional? | Léo + 3B |
| Formato de entrega do relatório do dia 10 (CSV por e-mail?) | Léo + Samuel |
| Que dado de saúde coletar, se algum | Léo + jurídico |
| Texto da tela ("não substitui 192/193") revisado | Jurídico |
