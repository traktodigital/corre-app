import ActivityKit
import SwiftUI
import WidgetKit

// Live Activity da jornada: tela bloqueada + Dynamic Island (iPhone 14 Pro+).
// Nos iPhones sem ilha, aparece só na tela bloqueada. Deployment target: 16.2.
// JornadaAttributes.swift vem de ios/CorreApp/Jornada (membro dos dois targets).

private let verde = Color(red: 0x10 / 255, green: 0x91 / 255, blue: 0x50 / 255) // palette.green

private func km(_ v: Double) -> String {
  String(format: "%.1f km", v).replacingOccurrences(of: ".", with: ",")
}

private func kmCurto(_ v: Double) -> String {
  (v < 100 ? String(format: "%.1f", v) : String(format: "%.0f", v))
    .replacingOccurrences(of: ".", with: ",") + "km"
}

/// Cronômetro que corre sozinho — sem precisar de atualização do app.
private func tempo(_ desde: Date) -> Text {
  Text(timerInterval: desde...Date.distantFuture, countsDown: false)
}

@main
struct CorreJornadaWidgetBundle: WidgetBundle {
  var body: some Widget {
    JornadaLiveActivity()
  }
}

struct JornadaLiveActivity: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: JornadaAttributes.self) { ctx in
      // Tela bloqueada / banner
      HStack(alignment: .center, spacing: 12) {
        Image(systemName: "location.fill")
          .font(.title2)
          .foregroundStyle(verde)
        VStack(alignment: .leading, spacing: 2) {
          Text("Jornada em andamento").font(.headline)
          Text(ctx.isStale ? "Sem sinal de GPS — abra o CORRE" : "Pode trocar de app. Só não feche o CORRE.")
            .font(.caption)
            .foregroundStyle(.secondary)
        }
        Spacer()
        VStack(alignment: .trailing, spacing: 2) {
          Text(km(ctx.state.km)).font(.title2.bold()).monospacedDigit()
          tempo(ctx.attributes.iniciadaEm).font(.caption).monospacedDigit()
            .multilineTextAlignment(.trailing)
        }
      }
      .padding()
      .activityBackgroundTint(Color.black.opacity(0.85))
      .activitySystemActionForegroundColor(.white)
    } dynamicIsland: { ctx in
      DynamicIsland {
        DynamicIslandExpandedRegion(.leading) {
          Label("Jornada", systemImage: "location.fill")
            .font(.caption.bold())
            .foregroundStyle(verde)
        }
        DynamicIslandExpandedRegion(.trailing) {
          Text(km(ctx.state.km)).font(.title3.bold()).monospacedDigit()
        }
        DynamicIslandExpandedRegion(.bottom) {
          HStack {
            Text(ctx.isStale ? "Sem sinal de GPS" : "Contando km")
              .font(.caption)
              .foregroundStyle(.secondary)
            Spacer()
            tempo(ctx.attributes.iniciadaEm).font(.caption).monospacedDigit()
              .multilineTextAlignment(.trailing)
          }
        }
      } compactLeading: {
        Image(systemName: "location.fill").foregroundStyle(verde)
      } compactTrailing: {
        Text(kmCurto(ctx.state.km)).monospacedDigit()
      } minimal: {
        Image(systemName: "location.fill").foregroundStyle(verde)
      }
    }
  }
}
