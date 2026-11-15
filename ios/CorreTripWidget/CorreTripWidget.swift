import ActivityKit
import SwiftUI
import WidgetKit

private let brandGreen = Color(red: 0x10 / 255, green: 0x91 / 255, blue: 0x50 / 255)

private func formatKm(_ value: Double) -> String {
  String(format: "%.1f km", value).replacingOccurrences(of: ".", with: ",")
}

private func formatShortKm(_ value: Double) -> String {
  (value < 100 ? String(format: "%.1f", value) : String(format: "%.0f", value))
    .replacingOccurrences(of: ".", with: ",") + "km"
}

private func elapsed(since start: Date) -> Text {
  Text(timerInterval: start...Date.distantFuture, countsDown: false)
}

@main
struct CorreTripWidgetBundle: WidgetBundle {
  var body: some Widget {
    TripLiveActivity()
  }
}

struct TripLiveActivity: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: TripActivityAttributes.self) { context in
      HStack(alignment: .center, spacing: 12) {
        Image(systemName: "location.fill")
          .font(.title2)
          .foregroundStyle(brandGreen)
        VStack(alignment: .leading, spacing: 2) {
          Text("Jornada em andamento").font(.headline)
          Text(context.isStale ? "Sem sinal de GPS — abra o CORRE" : "Pode trocar de app. Só não feche o CORRE.")
            .font(.caption)
            .foregroundStyle(.secondary)
        }
        Spacer()
        VStack(alignment: .trailing, spacing: 2) {
          Text(formatKm(context.state.km)).font(.title2.bold()).monospacedDigit()
          elapsed(since: context.attributes.startedAt).font(.caption).monospacedDigit()
            .multilineTextAlignment(.trailing)
        }
      }
      .padding()
      .activityBackgroundTint(Color.black.opacity(0.85))
      .activitySystemActionForegroundColor(.white)
    } dynamicIsland: { context in
      DynamicIsland {
        DynamicIslandExpandedRegion(.leading) {
          Label("Jornada", systemImage: "location.fill")
            .font(.caption.bold())
            .foregroundStyle(brandGreen)
        }
        DynamicIslandExpandedRegion(.trailing) {
          Text(formatKm(context.state.km)).font(.title3.bold()).monospacedDigit()
        }
        DynamicIslandExpandedRegion(.bottom) {
          HStack {
            Text(context.isStale ? "Sem sinal de GPS" : "Contando km")
              .font(.caption)
              .foregroundStyle(.secondary)
            Spacer()
            elapsed(since: context.attributes.startedAt).font(.caption).monospacedDigit()
              .multilineTextAlignment(.trailing)
          }
        }
      } compactLeading: {
        Image(systemName: "location.fill").foregroundStyle(brandGreen)
      } compactTrailing: {
        Text(formatShortKm(context.state.km)).monospacedDigit()
      } minimal: {
        Image(systemName: "location.fill").foregroundStyle(brandGreen)
      }
    }
  }
}
