import ActivityKit
import Foundation

/// Dados da Live Activity da jornada (tela bloqueada + Dynamic Island).
/// Este arquivo precisa estar nos DOIS targets: CorreApp e CorreJornadaWidget.
@available(iOS 16.1, *)
struct JornadaAttributes: ActivityAttributes {
  public struct ContentState: Codable, Hashable {
    /// Km filtrados (mesma soma do app). Atualizado a cada 0,5 km ou 1 min.
    var km: Double
  }

  /// O cronômetro do widget corre sozinho a partir daqui (Text(timerInterval:)).
  var iniciadaEm: Date
}
