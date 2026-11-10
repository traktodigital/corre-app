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

## Release iOS (App Store)

Bundle ID `br.com.soucorre.app`, nome "Sou Corre", só iPhone. Conta Apple
Developer: Leandro Monteiro, Team ID `87BW2UP49G` (`DEVELOPMENT_TEAM` do target `CorreApp`).

1. Uma vez só, na conta Apple:
   - Certificates, IDs & Profiles > Identifiers: registrar `br.com.soucorre.app`.
   - App Store Connect > Apps > "+": novo app iOS, nome "Sou Corre", idioma
     Português (Brasil), bundle `br.com.soucorre.app`, SKU `soucorre-ios`.
   - Adicionar quem vai gerar o build em Users and Access (papel App Manager
     ou Developer) e logar essa Apple ID no Xcode (Settings > Accounts).

2. Build:

   ```sh
   npm ci
   cp src/config/env.example.ts src/config/env.ts   # valores de produção
   cd ios && bundle install && bundle exec pod install
   open CorreApp.xcworkspace
   ```

   No Xcode: target CorreApp > Signing & Capabilities > Team da conta;
   suba `Build` (CURRENT_PROJECT_VERSION) a cada envio e `Version`
   (MARKETING_VERSION) a cada versão nova. Destino "Any iOS Device (arm64)" >
   Product > Archive > Distribute App > App Store Connect > Upload.

3. App Store Connect, antes de enviar para revisão:
   - Prints de iPhone 6.9" (1320×2868 ou 1290×2796) — os de `docs/loja/telas`
     são 1080×1920 (Android) e não servem.
   - Ícone 1024 já está no asset catalog (sem transparência).
   - URL de privacidade: `<SITE_URL>/privacidade`; URL de suporte.
   - App Privacy: nome, e-mail, telefone, endereço, ID do usuário e CPF
     (outros dados), todos vinculados ao usuário, sem rastreamento, para
     funcionalidade do app — o mesmo declarado em `PrivacyInfo.xcprivacy`.
   - Classificação etária, categoria, preço (grátis).
   - App Review Information: conta de teste já aprovada (login + senha),
     porque o app exige login e aprovação da associação.
   - Exclusão de conta já está no app (Perfil > Excluir minha conta),
     exigência da Apple.

Funcionalidades fora da Fase 1 ficam comentadas no código:
`rg "FORA DA FASE 1|NÃO CONECTADO" src`.

## Regras da Fase 1 (não negociáveis)

- RLS em toda tabela; o client só usa a publishable key.
- `service_role` e chaves financeiras só em Edge Function.
- Papéis via `papeis_usuario`, nunca campo `role` único.
- Multi-tenant por `associacao_id` desde o cadastro.
