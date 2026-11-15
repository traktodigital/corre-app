# ADR-0009 — Arquitetura do app: features em camadas, inglês no código

| | |
|---|---|
| **Status** | Aceito e implementado (branch `refactor/arquitetura`, 15/11/2026) |
| **Data** | 2026-11-15 |
| **Decisores** | Diogo |
| **Substitui** | Os caminhos de arquivo citados nas ADRs 0000–0008 (ver o de/para na §4) |

## 1. Contexto

O código misturava nomes em português e inglês. As telas falavam direto com o Supabase, e
uma feature importava arquivos internos de outra. Com várias frentes em paralelo (ADR-0005
§6.8), isso aumentava o acoplamento e o risco de conflito. O pedido foi: separar, desacoplar,
padronizar os nomes e garantir que o app **nunca trave se o usuário negar uma permissão**.

## 2. Decisões

| # | Decisão |
|---|---|
| D1 | **Feature + camadas:** `src/features/<feature>/{domain,data,ui}` + `index.ts`. **`domain`** tem tipos e regras puras (sem React, sem Supabase), que são o que os testes importam. **`data`** tem os repositórios e acessa Supabase/Storage/AsyncStorage. **`ui`** tem telas, componentes e hooks de tela |
| D2 | **`src/core`** é infraestrutura: `supabase/client`, `config/env`, `permissions` e `device/{location,camera,files}`. **`src/shared`** é o que vale para qualquer feature: `ui`, `layout`, `theme`, `hooks/useQuery`, `format`, `date`. **`src/app`** tem `App.tsx` (stack + abas) e `navigation.ts` |
| D3 | **Uma feature só fala com outra pelo `index.ts`** (`useSession`, `fetchProfile`, `fetchSavings`, `clearCardCache`, telas). Import de arquivo interno de outra feature é proibido |
| D4 | **Código em inglês** (pastas, arquivos, tipos, funções, variáveis, rotas, chaves de aba). **Textos de tela em PT-BR.** **O banco continua em PT** (tabelas, colunas, RPCs, enums, `user_metadata`), e a camada `data` traduz linha PT ↔ tipo EN. Também continuam iguais: chaves persistidas no aparelho (`corre:carteirinha`, `corre_jornada`, `corre.jornada`, `jornada-<id>.csv`) e o canal de notificação `jornada` |
| D5 | **Sem comentários no código.** A documentação vive nas ADRs e nos fluxos. Ficam só as diretivas (`eslint-disable`, `@ts-…`, `@Suppress`). Para reaplicar: `node scripts/strip-comments.mjs <arquivos>` (usa o AST do TypeScript; não quebra string, regex nem JSX) |
| D6 | **Permissões nunca lançam erro.** `core/permissions` devolve `'granted' / 'denied' / 'blocked' / 'unavailable'`. Os serviços de `core/device` devolvem resultado tipado (`started / denied / unavailable / failed`, `picked / cancelled / denied / …`). Sem localização, a jornada segue pelo odômetro. Com a câmera negada, oferece a galeria. Com a notificação negada, o rastreio continua. Sem o módulo nativo, tudo vira `'unavailable'` |
| D7 | **Nativo do GPS** renomeado para `TripTracker`: Android `br.com.trakto.corre.trip` (`TripTrackerService`, `TripTrackerModule`, `DistanceAccumulator`); iOS `ios/CorreApp/Trip/`; widget em `ios/CorreTripWidget/`, com o passo no Xcode no `README.md` |

## 3. Correções que vieram junto

- **Android 7–10:** desligar o GPS no meio da jornada derrubava o app (`AbstractMethodError`,
  faltavam os callbacks do `LocationListener`). Corrigido.
- **Android:** o `startForeground` agora é a primeira coisa, dentro de try/catch. O módulo
  captura `ForegroundServiceStartNotAllowedException` e `SecurityException`, o que evita o
  crash "startForegroundService sem startForeground".
- **`.gitignore`** passou a cobrir `src/core/config/env.ts` (sem isso, o arquivo com as
  chaves entraria no commit).
- **`useSession`** é estável entre renders, o que dá menos re-renders.

## 4. De/para (para ler as ADRs antigas)

| Caminho citado nas ADRs 0000–0008 | Agora |
|---|---|
| `src/lib/supabase.ts` · `src/config/env.ts` | `src/core/supabase/client.ts` · `src/core/config/env.ts` |
| `src/lib/formato.ts` · `src/lib/useConsulta.ts` | `src/shared/format.ts` · `src/shared/hooks/useQuery.ts` |
| `src/components/{ui,layout}` · `src/theme` | `src/shared/{ui,layout}` · `src/shared/theme` |
| `src/features/clube/*` (api, telas, components) | `src/features/club/{data/clubRepository.ts, domain/*, ui/*}` |
| `src/features/carteira/*` (`api.ts`, `screen.tsx`, `FiliacaoScreen.tsx`) | `src/features/wallet/{data/walletRepository.ts, domain/*, ui/screens/WalletScreen.tsx, ui/screens/MembershipRequestScreen.tsx}` |
| `src/features/admin/*` | `src/features/admin/{data,domain,ui/screens/MembershipRequestsAdminScreen.tsx}` |
| `src/features/profile/{api.ts, screen.tsx, EditarPerfilScreen.tsx}` | `src/features/profile/{data/profileRepository.ts, ui/screens/ProfileScreen.tsx, ui/screens/EditProfileScreen.tsx}` |
| `src/features/profile/HistoricoScreen.tsx` | `src/features/club/ui/screens/RedemptionHistoryScreen.tsx` |
| `src/features/home/screen.tsx` | `src/features/home/ui/HomeScreen.tsx` |
| `src/features/auth/*` | `src/features/auth/{data,domain,ui}` |
| `src/features/jornada/*` (telas, `api.ts`, `regras.ts`, `componentes.tsx`) | `src/features/trip/{ui/screens/*, data/tripRepository.ts, domain/rules.ts, ui/components/*}` |
| `src/features/jornada/gps.ts` | `src/core/device/location` + `src/core/permissions` |
| `android/.../jornada/{KmAcumulador,JornadaService,JornadaGpsModule}.kt` | `android/.../trip/{DistanceAccumulator,TripTrackerService,TripTrackerModule,TripTrackerPackage}.kt` |
| `ios/CorreApp/Jornada/*` · `ios/CorreJornadaWidget/*` (`LEIAME.md`) | `ios/CorreApp/Trip/*` · `ios/CorreTripWidget/*` (`README.md`) |
| Rotas `Parceiro, Oferta, Resgate, Filiacao, FiliacoesAdmin, EditarPerfil, Historico, IniciarJornada, Abastecimento, EncerrarJornada, ResumoJornada` | `Partner, Offer, Redemption, MembershipRequest, MembershipRequestsAdmin, EditProfile, RedemptionHistory, StartTrip, Refuel, EndTrip, TripSummary` (parâmetro `tripId`) |
| Abas `entregas, inicio, beneficios, carteira, perfil` | `trip, home, benefits, wallet, profile` |

## 5. Verificação

tsc · eslint · prettier · Jest **67/67** (8 suítes, inclusive permissões) · `assembleDebug`
· testes nativos do km **5/5**. **O Swift não foi compilado** (não há Xcode no ambiente).

## 6. Consequências

- Frentes novas (Ligeirin, emergência, Minha Moto) entram como features isoladas. Dá para
  dividir entre pessoas ou agentes sem conflito.
- Toda feature nova segue D1–D6. Revisar no code review: import entre features só pelo
  `index`, `domain` sem React/Supabase e nenhum comentário.
- Os comentários de template do React Native no `android/app/build.gradle` e os scripts SQL
  em `docs/backend/` continuam com comentários (são configuração e documentação, não código
  do app).
