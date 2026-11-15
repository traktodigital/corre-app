# ADR-0002 — CORRE Fase 2: km rodado, trajeto, apps e corridas do entregador

| | |
|---|---|
| **Status** | Proposto. Escopo da Fase 2, com a equipe da Hank |
| **Data** | 2026-11-15 |
| **Decisores** | Léo, Diogo, equipe Hank |
| **Fonte** | `CORRE_Escopo_Tecnico_Dev_Fase1`, seção 2 ("Fora do escopo agora") |

## 1. Contexto

O escopo da Fase 1 deixou para a Fase 2: **geolocalização, km rodado por dia, em qual app o
entregador roda, upload de PDF de corridas e dashboard comparativo**. Os documentos têm só
essa linha, sem regra detalhada. Esta ADR propõe a base técnica antes de a Hank começar.

O app hoje tem só a permissão `INTERNET` no Android e nenhuma lib de localização. Os
marcadores já estão no código: `TabBar.tsx:7` (aba "entregas") e `home/screen.tsx:207`
("Perto de você"). O app usa RN 0.87 com New Architecture ligada.

O Corre Frete (matching e acompanhamento em tempo real, fases 6–8) **não** entra aqui. Ver G5.

## 2. Decisões

| # | Decisão | Por quê |
|---|---|---|
| D1 | **Rastrear só "em turno"**: o entregador toca em *Iniciar corre* / *Encerrar*. No Android, foreground service do tipo `location` com notificação fixa. No iOS, *When In Use* com atualização em segundo plano | Dispensa `ACCESS_BACKGROUND_LOCATION` e a permissão *Always*, que são as que mais geram recusa nas lojas e gastam mais bateria. O entregador vê e controla quando está sendo rastreado. |
| D2 | **O km é calculado no aparelho.** O servidor recebe **um resumo por turno** (km, início/fim, duração, trajeto simplificado), não ponto a ponto | Evita G1. O Postgres guarda o que o dashboard usa. |
| D3 | **Filtro de qualidade no aparelho**: descartar pontos com precisão ruim (~30 m), saltos acima de ~120 km/h e deslocamentos mínimos (jitter). Registrar se o ponto veio de localização simulada (mock) | Sem filtro, a soma de distâncias (haversine) infla o km com o GPS "tremendo" parado no semáforo. |
| D4 | **O servidor valida plausibilidade** (velocidade média, duração, km por hora) e marca o turno como `suspeito`, sem rejeitar | O client não é confiável se o km um dia valer benefício. Marcar em vez de bloquear evita punir GPS ruim. |
| D5 | **"Em qual app roda" é autodeclarado** (tabela N:N `usuario_apps`) | Não há API pública conhecida dos apps de entrega para o entregador exportar os próprios dados. |
| D6 | **PDF de corridas**: upload em bucket privado (RLS por dono) e processamento **assíncrono**. Parser por app quando o PDF tem texto, LLM só como fallback. O resultado é sempre **"declarado"** | O PDF pode ser editado, então nunca vale como prova. O assíncrono evita o limite de tempo de Edge Function (G3). |
| D7 | **O dashboard só lê agregados diários** (`km_diario`, `ganhos_diario`) | Consulta barata e previsível (G4). |
| D8 | **As regras da ADR-0001 valem igual**: RLS desde a criação, `associacao_id`, `papeis_usuario`, nada de `service_role` no client. ASSEMAG e parceiros veem **só agregado anonimizado**, nunca o trajeto individual | Localização contínua revela casa e rotina. É o dado mais invasivo do app. |
| D9 | **Contrato de dados definido antes da Hank codar**: tabelas, RPCs e políticas versionadas em migration. A Hank implementa por cima | Com uma equipe externa, o drift de banco (ADR-0001 L2) piora. |
| D10 | **Turno visível fora do app.** Android: a notificação fixa do foreground service (já obrigatória) vira o painel do turno (km, tempo, botões *Pausar*/*Encerrar*). No Android 16+, ela é promovida a *Live Update* (chip na barra de status). iOS: *Live Activity* (ActivityKit) na tela bloqueada e na Dynamic Island, atualizada pelo próprio app enquanto recebe localização | O entregador troca para iFood/99 o tempo todo. Ver o turno ativo sem abrir o CORRE reduz o "esqueci de encerrar" e dá confiança de que o km está contando. No Android, o custo extra é só o layout. |

## 3. Pontos limitantes

**L1 — Política das lojas.** A Play exige declaração e vídeo para localização em segundo
plano e recusa quando ela não é a função principal. No Android 14, o tipo de foreground
service também precisa ser declarado no Console. A Apple pede justificativa, e a conta Apple
ainda está pendente. → D1 reduz bastante o risco, mas a declaração do foreground service
continua obrigatória.

**L2 — Celular barato mata o app em segundo plano.** Xiaomi, Samsung e Motorola matam
serviços para economizar bateria, mesmo com foreground service. O resultado são buracos no
trajeto e km subestimado. → Tela de orientação ("tirar o app da economia de bateria") e
aviso no resumo quando houver buracos longos.

**L3 — Plano de dados pré-pago.** Mandar ponto a ponto consome a franquia do entregador.
→ Envio em lote e compactado (D2).

**L4 — Precisão do GPS.** Prédios e túneis atrapalham, e a amostragem baixa "corta" curvas
e subestima. Map matching (OSRM, Mapbox) corrige, mas custa infraestrutura ou dinheiro.
→ Fica para depois, só se a precisão do km virar requisito.

**L5 — Sem dados oficiais dos apps de entrega.** Sem integração, não dá para separar "km em
corrida" de "km rodado total". O ganho por app depende do PDF, que é autodeclarado. O
dashboard comparativo é **indicativo**, não auditável.

**L6 — LGPD.** Localização contínua exige consentimento específico, destacado e revogável,
além de entrar na política de privacidade e na seção "Segurança dos dados" da Play. Ao
contrário dos resgates, o trajeto **não** é dado fiscal: na exclusão de conta (ADR-0001 D7),
ele é **apagado**, não anonimizado. O trajeto bruto deve ter retenção curta.

**L7 — Lib de localização em segundo plano.** Precisa suportar New Architecture. A mais
completa (`react-native-background-geolocation`) tem licença paga para build release no
Android (confirmar valor). A alternativa é um módulo nativo próprio (FusedLocationProvider +
foreground service no Android, CoreLocation no iOS): mais código, sem licença. → Decidir no
início da Fase 2, com protótipo nos aparelhos reais do público.

**L8 — Equipe externa no mesmo banco.** Sem migrations versionadas nem testes SQL no CI,
qualquer tabela nova da Hank pode nascer sem RLS. → D9 e M7 da ADR-0001 viram pré-requisito.

**L9 — Sair do app vs. fechar o app.** *Trocar* de app ou bloquear a tela: o rastreamento
continua nos dois sistemas (foreground service no Android; `UIBackgroundModes: location` +
`allowsBackgroundLocationUpdates` no iOS, com o indicador azul). *Fechar* (arrastar dos
recentes): no Android, o serviço segue na maioria dos aparelhos (alguns fabricantes matam,
ver L2). No iOS, com *When In Use*, o rastreamento **para** e nada religa sozinho. Só com
*Always* + "mudança significativa de localização" (precisão grosseira) o sistema relança o app.
Reiniciar o celular para nos dois.
→ Não pedir *Always* por isso. Avisar no início do turno ("pode trocar de app, só não feche o
CORRE"), detectar o buraco no trajeto e perguntar na volta se quer encerrar ou continuar o turno.

**L10 — Limites de Dynamic Island, Live Activity e Live Updates.**
- Live Activity exige uma **extensão de widget nativa em Swift/SwiftUI**: o React Native não
  desenha nela. Também exige `NSSupportsLiveActivities` no `Info.plist`.
- Fica ativa por **no máximo ~8 h**. Turno mais longo precisa encerrar e recriar a atividade.
- A Dynamic Island só existe do iPhone 14 Pro em diante. Nos outros iPhones, a atividade
  aparece só na tela bloqueada.
- O sistema limita atualizações frequentes: atualizar a cada ~1 km ou 1 min, não a cada ponto.
- O *Live Update* do Android 16 só chega em aparelhos novos. A base continua sendo a
  notificação comum, que funciona em todos.

→ **Android primeiro** (maioria do público, e a notificação já é obrigatória). Live Activity
no iOS depois.

## 4. Gargalos

Os números são estimativas para dimensionar o problema.

**G1 — Volume de pontos.** 1 ponto a cada 10 s × 10 h/dia = 3.600 pontos por entregador por
dia. Com 10 mil entregadores ativos, são cerca de 36 milhões de linhas/dia, ou cerca de 1 bilhão/mês.
Isso não cabe barato no Postgres do Supabase (armazenamento, índices, vacuum).
→ D2. O bruto é guardado como **arquivo por turno** (polyline/GeoJSON comprimido) no Storage,
nunca como linha por ponto. Fica identificado por 30–90 dias e depois vira agregado anonimizado
de longo prazo, que é o insumo de IA (ADR-0003 D6).

**G2 — Rajada no fim do expediente.** Muita gente encerra o turno no mesmo horário (~22–23 h).
→ Envio com atraso aleatório (jitter), retry com backoff e endpoint **idempotente** por
`turno_id` (UUID gerado no aparelho, com constraint única). Retry de rede não duplica km.

**G3 — Processamento de PDF.** PDFs grandes ou escaneados (OCR) e o fallback por LLM estouram
o tempo e a memória de Edge Function e têm custo por arquivo.
→ Fila + worker, limite de tamanho e de uploads por dia, e parser dedicado para os 1–2 apps
mais usados (medir antes qual são).

**G4 — Dashboard calculado na hora.** Agregar milhões de linhas a cada abertura de tela não
escala. → Agregado diário gravado na ingestão do turno ou por job (D7).

**G5 — Tempo real do Corre Frete (fases 6–8).** O matching precisa da posição a cada poucos
segundos: é outra ordem de grandeza (milhares de posições/s), e o Postgres/Realtime não é o
lugar disso. → **Não desenhar a Fase 2 para esse caso**, mas manter a ingestão de localização
num endpoint e numa tabela próprios, para trocar o backend depois (ex.: Redis GEO ou serviço
dedicado) sem mexer no app inteiro.

**G6 — "Perto de você" não é gargalo.** Parceiros são poucos milhares de linhas: PostGIS com
índice GiST resolve. Só precisa de localização **com o app aberto**, sem segundo plano.

## 5. Sequência recomendada (do menor ao maior risco)

| # | Entrega | Por que nessa ordem |
|---|---|---|
| 1 | "Perto de você" (PostGIS nos parceiros, localização só com o app aberto) | Valida a permissão e a UX de localização sem a política de segundo plano. |
| 2 | Cadastro de apps em que roda (autodeclarado) | Trivial, e já alimenta o dashboard. |
| 3 | Turno com km no aparelho + resumo no servidor (D1–D4) | É o MVP do km. Testar antes em aparelhos baratos (L2). |
| 4 | Upload de PDF, com parser dos 1–2 apps mais usados | Medir o uso antes de cobrir todos. |
| 5 | Dashboard comparativo sobre os agregados | Só depois que existirem dados. |
| 6 | Antifraude de km reforçado | **Só se o km virar dinheiro ou benefício** (ver pendências). |
| 7 | Live Activity / Dynamic Island no iOS (D10) | O público é majoritariamente Android. Entra depois que o turno no Android estiver estável. |

## 6. Consequências

**Positivas**
- Rastrear só em turno, com o km no aparelho, mantém lojas, bateria, plano de dados e banco
  dentro do limite.
- A privacidade fica forte por padrão: terceiros só veem agregados.
- O caminho para o Corre Frete fica aberto, sem pagar por ele agora.

**Negativas / custos**
- O km é estimado, não auditável, enquanto não houver map matching ou dados dos apps.
- Lib paga ou módulo nativo próprio: custa dinheiro ou tempo de dev.
- Mais uma superfície LGPD para documentar (consentimento, retenção, exclusão).

## 6b. Inteligência coletiva (rev. 2 do Léo, 15/11)

"Quem está pagando melhor, em qual horário e em qual região", calculado pela base inteira.
É o diferencial do produto.

**Fontes** (capturadas desde o 1º dia da aba Entregas, ADR-0005 §6.2):
- **Combustível:** cupom fiscal (preço/litro, tipo, posto, data/hora, célula).
- **Ganhos:** comprovante por app no encerramento.
- **Km:** odômetro no início e no fim.

**Métricas:**
- preço médio do combustível por posto e por região;
- ganho médio por app × região × janela de horário (manhã, almoço, tarde, jantar, madrugada);
- melhor horário para rodar;
- ganho por km.

| Decisão | Regra |
|---|---|
| **Ganho por km por app só em dia de app único** | Com mais de um app marcado na jornada, o odômetro não separa os km. Nesses dias, mostrar só o ganho/km **do dia** (rotulado como média do dia). O comparativo "app X paga mais por km que Y" usa apenas jornadas com 1 app |
| **Piso de confiabilidade** (proposta do Léo, número a confirmar) | Só mostrar uma média com **≥ 20 registros, de ≥ 10 entregadores diferentes**, na combinação região + janela + app, **nos últimos 30 dias**. Abaixo disso: "ainda não temos dado suficiente aqui". Aplicado no SQL (`having`), não na tela |
| **Separado do comercial de verdade** | Função de agregação própria, `SECURITY DEFINER`, que devolve **só agregados** (nunca linha individual) e **não lê** `parceiros` nem o nível comercial. A recomendação comercial (ADR-0005 §6.4) é outro caminho. Os dois nunca se misturam no código |
| **Região** | Célula aproximada (~1 km) da jornada/abastecimento. Fica guardada só a célula, não o trajeto (ADR-0003 D6). Na v1, a cidade do perfil pode servir enquanto a célula não existe |
| **Clima e trânsito** ("melhor horário") | Fica para depois: clima tem API grátis (ex.: Open-Meteo); trânsito costuma ser pago. Começar só com o histórico de ganho |

## 7. Decisões de negócio em aberto

| Decisão | Por que importa | Quem |
|---|---|---|
| **Para que serve o km?** Base de dados para IA (ADR-0003) é certo. Benefício, CORRECOIN, seguro, prova para financiamento de moto? | Define o rigor antifraude, a retenção e se o client pode ser confiável | Léo |
| Quem vê os dados (ASSEMAG, parceiros, Hank) e em que nível? | Define as políticas de RLS e o texto do consentimento | Léo + ASSEMAG |
| Retenção do trajeto bruto | Custo de armazenamento + LGPD | Léo + jurídico |
| Quais apps de entrega priorizar no PDF | Define o parser inicial | Léo (dados de uso) |
| Lib paga ou módulo nativo próprio (L7) | Custo vs. prazo | Léo + Diogo |
| Quem é dono das migrations e da revisão de segurança com a Hank | Evita tabela sem RLS | Léo + Hank |
