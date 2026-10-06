# CORRE — Clube do Entregador (app)

App React Native do CORRE. O backend (Supabase: migrations, RLS, Edge Functions)
e os painéis web (associação, parceiro) ficam no projeto web `goias-delivery-link`.

## Estrutura

```
src/
  app/          navegação e raiz do app
  components/   ui/ (botões, cards, estados) e layout/ (tela, abas, header)
  config/       env.ts (gerado, gitignored) — só URL + publishable key
  features/     um diretório por área: auth, home, clube, carteira, profile
                cada um com api.ts (Supabase) + telas
  lib/          supabase client, useConsulta, formatação
  theme/        tokens e cores
```

Nova área = nova pasta em `features/` com `api.ts` + telas, registrada em
`src/app/navigation.ts` e `src/app/App.tsx`.

## Rodar

```sh
npm ci
cp src/config/env.example.ts src/config/env.ts   # preencha com os valores do .env
npm start
npm run android
```

Checagens: `npx tsc --noEmit`, `npm run lint`, `npm test`.

## Release Android (Google Play)

1. Upload key em `~/.gradle/gradle.properties` (nunca no repositório):

   ```properties
   CORRE_UPLOAD_STORE_FILE=/caminho/corre-upload.keystore
   CORRE_UPLOAD_STORE_PASSWORD=...
   CORRE_UPLOAD_KEY_ALIAS=...
   CORRE_UPLOAD_KEY_PASSWORD=...
   ```

   Sem essas propriedades o release é assinado com a chave debug — roda
   localmente, mas o Play recusa.

2. Gere o AAB com um `versionCode` maior que o último enviado:

   ```sh
   cd android && ./gradlew bundleRelease -PCORRE_VERSION_CODE=2
   ```

   Saída: `android/app/build/outputs/bundle/release/app-release.aab`.

3. No Play Console, informe a URL de exclusão de conta:
   `<SITE_URL>/excluir-conta`. **Pendente:** a página ainda não existe no site;
   depois de criada, reative "Excluir minha conta" em `features/profile/screen.tsx`.

Funcionalidades fora da Fase 1 ficam comentadas no código:
`rg "FORA DA FASE 1|NÃO CONECTADO" src`.

## Regras da Fase 1 (não negociáveis)

- RLS em toda tabela; o client só usa a publishable key.
- `service_role` e chaves financeiras só em Edge Function.
- Papéis via `papeis_usuario`, nunca campo `role` único.
- Multi-tenant por `associacao_id` desde o cadastro.
