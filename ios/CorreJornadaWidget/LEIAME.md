# iOS — GPS da jornada + Dynamic Island (passo único no Xcode)

O código está pronto. O que falta precisa de um Mac com Xcode: um target novo não dá
para criar com segurança editando o `project.pbxproj` à mão.

## 1. Módulo de GPS (target CorreApp)

1. Arraste a pasta `ios/CorreApp/Jornada/` para o grupo **CorreApp** no Xcode.
   Marque **"Create groups"** e o target **CorreApp**.
2. `JornadaGps.swift`, `JornadaGps.m` e `JornadaAttributes.swift` devem estar em
   *Build Phases → Compile Sources* do CorreApp.
3. O `Info.plist` já foi atualizado com:
   - `NSLocationWhenInUseUsageDescription` (texto da permissão);
   - `UIBackgroundModes` = `location` (sem isso, o app **trava** ao iniciar a jornada);
   - `NSSupportsLiveActivities` = YES.
4. **Não** adicionar `NSLocationAlwaysAndWhenInUseUsageDescription`. A decisão é "Durante
   o uso" (ADR-0002 D1).

## 2. Dynamic Island / Live Activity (target novo)

1. *File → New → Target → **Widget Extension***.
   - Nome: `CorreJornadaWidget`.
   - Marque **Include Live Activity**. Desmarque *Include Configuration App Intent*.
   - Quando o Xcode perguntar "Activate scheme?", responda **Cancel**.
2. Apague os `.swift` gerados pelo Xcode na pasta do widget e adicione
   `ios/CorreJornadaWidget/CorreJornadaWidget.swift` ao target **CorreJornadaWidget**.
3. Selecione `ios/CorreApp/Jornada/JornadaAttributes.swift` → *File inspector →
   Target Membership* → marque **também** `CorreJornadaWidget`.
4. Target CorreJornadaWidget → *General → Minimum Deployments* → **iOS 16.2**.
   O app continua no 15.1: abaixo de 16.2 só não aparece a ilha.
5. *Signing & Capabilities*: mesmo Team do app. O bundle id fica
   `br.com.corre.app.CorreJornadaWidget`.
6. `cd ios && pod install` (o widget não usa pods, mas regenera o workspace) e
   rode no aparelho.

## 3. Como testar

- Iniciar uma jornada → aparecem o indicador azul e a Live Activity (tela bloqueada).
- No iPhone 14 Pro ou mais novo: a ilha mostra o ícone + km. Toque longo expande e mostra o
  km e o tempo. O tempo corre sozinho, sem atualização do app.
- Troque para outro app e ande: o km sobe a cada 0,5 km ou 1 min.
- Fique 15 min sem sinal: o widget mostra "Sem sinal de GPS".
- **Limites conhecidos** (ADR-0002 L9/L10):
  - fechar o app (arrastar) para o GPS;
  - a Live Activity dura no máximo cerca de 8 h, e uma nova só é criada com o app aberto;
  - o simulador não tem Dynamic Island de verdade: teste num aparelho.
