# ADR-0004 — CORRE: biometria (rosto/digital) e guarda da sessão

| | |
|---|---|
| **Status** | Proposto |
| **Data** | 2026-11-15 |
| **Decisores** | Léo, Diogo |
| **Relacionadas** | [ADR-0001](0001-fase1-seguranca-escala.md) (L6, L8) |

## 1. Contexto

Ideia: usar o rosto ou a digital do celular para o entregador não precisar logar de novo.

Hoje (`src/lib/supabase.ts`) a sessão **já é persistente**: `persistSession: true` no
AsyncStorage, `autoRefreshToken` e renovação ao voltar para o app (`AppState`). Quem não sai
da conta continua logado indefinidamente, a menos que:

| Causa de perder o login | A biometria resolve? |
|---|---|
| Limite de sessão configurado no Supabase (time-box / inatividade) | ❌ É configuração do painel. Conferir |
| Refresh token revogado (troca de senha, logout global, exclusão) | ❌ Precisa logar de novo, por segurança |
| Corrida de refresh (dois refresh simultâneos com rotação de token) | ❌ É bug de cliente. Medir antes |
| Reinstalar o app no Android (`allowBackup="false"` apaga tudo) | ❌ O Keystore do Android também some na reinstalação |
| Celular na mão de outra pessoa abre carteirinha, CPF e resgates | ✅ **Esse é o ganho real** |
| Token de sessão em texto puro no AsyncStorage | ✅ Se a sessão for para o Keychain/Keystore (D2) |

**Conclusão:** biometria é uma **trava de acesso ao app** e uma melhoria de segurança da
sessão, não um mecanismo de login. Para "não perder o login", o caminho é D4 + OTP por SMS
(ADR-0001 M19).

## 2. Decisões

| # | Decisão | Por quê |
|---|---|---|
| D1 | **Trava do app com biometria ou com a senha/padrão do celular**: pede ao abrir e ao voltar depois de X min em segundo plano. **Opcional** (o entregador liga no perfil). Sem sensor ou com falha, cai na senha/padrão do aparelho | Muitos celulares do público não têm sensor bom. Nunca trancar alguém fora do app. |
| D2 | **Sessão do Supabase no Keychain (iOS) / Keystore (Android)**, por um adaptador de `storage` do supabase-js, **sem** pedir biometria a cada leitura | O `autoRefreshToken` lê o storage com frequência. Biometria em cada leitura geraria prompt a toda hora. Criptografar resolve o texto puro. |
| D3 | **Uma lib só: `react-native-keychain`** (armazenamento seguro + controle de acesso biométrico + detecção do tipo de sensor). A trava (D1) é um item no Keychain com `accessControl` biométrico/senha do aparelho: conseguir ler o item é a prova de que a pessoa passou | Não precisa de uma segunda lib de biometria. Confirmar o suporte a New Architecture (RN 0.87) na versão escolhida. |
| D4 | **Diagnosticar o "perdeu o login" antes**: conferir no painel Supabase (Auth → Sessions) se há time-box ou timeout de inatividade, e logar o evento `SIGNED_OUT` com o motivo (D1/D3 da ADR-0003) | Sem saber a causa, a biometria vira solução para o problema errado. |
| D5 | **Nunca guardar a senha** do usuário no aparelho, nem "atrás da biometria" | Vazaria uma credencial reaproveitável (a pessoa usa a mesma senha em outros lugares). |
| D6 | **Funciona offline** | A biometria é local, então combina com a carteirinha offline (ADR-0001 D6). |

## 3. Pontos limitantes

- **L1 — A trava local não é barreira contra root/jailbreak.** Protege contra a pessoa ao
  lado, não contra um atacante com o aparelho comprometido. A barreira real continua no
  servidor (RLS, tokens curtos).
- **L2 — Celulares baratos:** sensor ruim, ou só "biometria fraca" (reconhecimento facial 2D
  pela câmera). Por isso o fallback para a senha do aparelho é obrigatório (D1).
- **L3 — Reinstalar no Android apaga tudo**, inclusive o Keystore. A biometria não sobrevive
  à reinstalação, e o login também não.
- **L4 — iOS** exige `NSFaceIDUsageDescription` no `Info.plist`, e a conta Apple ainda está pendente.
- **L5 — Nova dependência nativa** (`react-native-keychain`): pod install, build nativo e
  teste em aparelho real Android e iOS.

## 4. Gargalos

Nenhum de servidor: tudo roda no aparelho. O risco é de **suporte**: o entregador trocou de
celular ou esqueceu a senha do aparelho e fica preso. → D1 (opcional, com fallback) e
"Sair e entrar de novo" sempre disponível na tela de trava.

## 5. Sequência

1. **D4**: conferir a configuração de sessão do Supabase e medir o motivo dos logouts.
2. **D2**: sessão no Keychain/Keystore. Fecha o texto puro e é invisível para o usuário.
3. **D1**: trava opcional com biometria/senha do aparelho, ligada no perfil.
4. **OTP por SMS** (ADR-0001 M19): resolve o relogin de verdade, sem depender de senha.

## 6. Decisões em aberto

| Decisão | Quem |
|---|---|
| A trava vem ligada por padrão ou é opt-in? (sugestão: opt-in, com convite após o 1º login) | Léo |
| Tempo em segundo plano até pedir de novo (sugestão: 5 min) | Léo |
| A trava também vale para gerar resgate e para abrir a carteirinha, ou só para abrir o app? | Léo |
