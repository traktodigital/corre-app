# iOS — GPS da jornada + Dynamic Island (passo único no Xcode)

O código está pronto. O que falta precisa de um Mac com Xcode: um target novo não dá
para criar com segurança editando o `project.pbxproj` à mão.

Enquanto este passo não for feito, o app não quebra: sem o módulo nativo `TripTracker`, a
ponte JS (`src/core/device/location`) responde `unavailable`, a jornada abre sem GPS e o km
do dia sai pelo odômetro.

## 1. Módulo de GPS (target CorreApp)

1. Arraste a pasta `ios/CorreApp/Trip/` para o grupo **CorreApp** no Xcode.
   Marque **"Create groups"** e o target **CorreApp**.
2. `TripTracker.swift`, `TripTracker.m` e `TripActivityAttributes.swift` devem estar em
   *Build Phases → Compile Sources* do CorreApp.
3. O `Info.plist` já foi atualizado com:
   - `NSLocationWhenInUseUsageDescription` (texto da permissão);
   - `UIBackgroundModes` = `location` (sem isso, o GPS só conta com o app aberto na tela);
   - `NSSupportsLiveActivities` = YES;
   - `NSCameraUsageDescription` e `NSPhotoLibraryUsageDescription` (fotos do painel e do cupom).
4. **Não** adicionar `NSLocationAlwaysAndWhenInUseUsageDescription`. A decisão é "Durante
   o uso" (ADR-0002 D1).
5. O módulo aparece no JS como `NativeModules.TripTracker`, com os métodos
   `requestPermission`, `getPermissionStatus`, `start(tripId)`, `getState` e `stop`
   (mesma API do Android, `TripTrackerModule.kt`).

## 2. Dynamic Island / Live Activity (target novo)

1. *File → New → Target → **Widget Extension***.
   - Nome: `CorreTripWidget`.
   - Marque **Include Live Activity**. Desmarque *Include Configuration App Intent*.
   - Quando o Xcode perguntar "Activate scheme?", responda **Cancel**.
2. Apague os `.swift` gerados pelo Xcode na pasta do widget e adicione
   `ios/CorreTripWidget/CorreTripWidget.swift` ao target **CorreTripWidget**.
3. Selecione `ios/CorreApp/Trip/TripActivityAttributes.swift` → *File inspector →
   Target Membership* → marque **também** `CorreTripWidget`.
4. Target CorreTripWidget → *General → Minimum Deployments* → **iOS 16.2**.
   O app continua no 15.1: abaixo de 16.2 só não aparece a ilha.
5. *Signing & Capabilities*: mesmo Team do app. O bundle id fica
   `br.com.corre.app.CorreTripWidget`.
6. `cd ios && pod install` (o widget não usa pods, mas regenera o workspace) e
   rode no aparelho.

## 3. Como testar

- Iniciar uma jornada → aparecem o indicador azul e a Live Activity (tela bloqueada).
- No iPhone 14 Pro ou mais novo: a ilha mostra o ícone + km. Toque longo expande e mostra o
  km e o tempo. O tempo corre sozinho, sem atualização do app.
- Troque para outro app e ande: o km sobe a cada 0,5 km ou 1 min.
- Fique 15 min sem sinal: o widget mostra "Sem sinal de GPS".
- Negue a localização: a jornada abre mesmo assim, a aba Entregas avisa que o km vai sair
  pelo odômetro e mostra **Abrir ajustes**. Ao liberar nos Ajustes e voltar, o GPS religa.
- Desligue as Live Activities do CORRE nos Ajustes: o GPS continua contando, só não aparece
  a ilha nem o card na tela bloqueada.
- **Limites conhecidos** (ADR-0002 L9/L10):
  - fechar o app (arrastar) para o GPS;
  - a Live Activity dura no máximo cerca de 8 h, e uma nova só é criada com o app aberto;
  - o simulador não tem Dynamic Island de verdade: teste num aparelho.

## 4. Regra do km (igual nos dois sistemas)

`DistanceAccumulator` (Swift em `TripTracker.swift`, Kotlin em
`android/.../trip/DistanceAccumulator.kt`): precisão pior que 30 m é descartada,
deslocamento menor que 10 m não soma, salto acima de 120 km/h é descartado e mais de
120 s sem ponto conta como buraco. Mudou num, muda no outro.

As chaves salvas no aparelho não mudaram com a renomeação: `UserDefaults` `corre.jornada`
(iOS), `SharedPreferences` `corre_jornada` (Android) e o arquivo do trajeto
`jornada-<id>.csv`.
