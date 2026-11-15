# ADR-0008 — Acesso de parceiros e associações dentro do app (link discreto no rodapé)

| | |
|---|---|
| **Status** | Proposto |
| **Data** | 2026-11-15 |
| **Fonte** | `CORRE_Rota_Copiloto_Ligeirin_DiogoDev` §7 |

## 1. Contexto

O mesmo app atende o entregador e o parceiro comercial. Ao abrir, a tela é **sempre a do
entregador**. O parceiro entra por um link pequeno, "Acesso parceiro", no rodapé, que leva a
um login separado. Os dois fluxos não se cruzam. Hoje, toda a gestão do parceiro fica no
painel web (ADR-0000 §3.3/3.5).

## 2. Decisões

| # | Decisão | Por quê |
|---|---|---|
| D1 | Depois do login, abrir o **painel web atual numa WebView** (rota (a) do Léo). Tela nativa só depois | Não duplica o painel. É o caminho mais rápido |
| D2 | **Login separado dentro da própria WebView** (o painel web tem o seu). A sessão do entregador no app **não** é reaproveitada, e os cookies são limpos ao sair | Os dois públicos não se cruzam. Um celular compartilhado não mistura as contas |
| D3 | O link aparece **só no rodapé do Perfil e da tela de boas-vindas**, em texto pequeno, sem cor de destaque. Nenhum push nem onboarding empurra para ele | Pedido do Léo |
| D3b | **Áudio do Léo (15/11, 13h58):** o link fica no **rodapé da tela de entrada** (boas-vindas/login) e serve **tanto para o parceiro comercial quanto para a associação** ("baixa o mesmo app; aqui embaixo tem a rota para você logar e entrar na sua área"). É o argumento de venda do comercial. Texto do link: **"Área de parceiros e associações"** | Um só app para os três públicos, e o entregador continua sendo o centro da tela |
| D5 | **Um login de gestão, destino pelo papel** (`papeis_usuario`): `parceiro` → painel do parceiro (WebView, D1); `admin_associacao` → área da associação (a aprovação de filiações já é nativa, `FiliacoesAdminScreen`; o restante, como gestão de associados e pagamentos, abre o painel web por WebView). Conta sem papel de gestão → "Esta conta não tem acesso de gestão", sem abrir nada | Quem decide é o papel no banco, não a tela. É o mesmo controle da RLS (ADR-0001 D1) |
| D4 | O **parceiro valida resgate** pelo painel, que precisa usar `validar_resgate` (ADR-0001 L4). Antes de prometer prazo de integração com o Ligeirin, confirmar esse estado | Sem isso, o limite de tentativas não vale para quem valida pelo app |

## 3. Pontos limitantes

- **L1 — Revisão da Apple:** funcionalidade que o revisor não enxerga é motivo de recusa
  (diretriz de "recursos ocultos"). → Explicar o link nas *Review Notes* e mandar uma
  **conta de parceiro de demonstração**. Na Play, informar o mesmo na seção de acesso ao app.
- **L2:** a WebView exige uma dependência nova (`react-native-webview`). O painel precisa
  funcionar bem em tela de celular, o que precisa ser conferido.
- **L3:** a câmera para ler o QR do resgate dentro da WebView depende de permissão e do
  suporte do painel web. Se não funcionar, a validação por código digitado (`CC-XXXX`) continua valendo.

## 4. Pendências

| Pendência | Quem |
|---|---|
| O painel web funciona bem no celular? | Diogo (testar) |
| O painel já usa `validar_resgate`? | Quem mantém o painel |
