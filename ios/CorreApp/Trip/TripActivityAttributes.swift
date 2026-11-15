import ActivityKit
import Foundation

@available(iOS 16.1, *)
struct TripActivityAttributes: ActivityAttributes {
  public struct ContentState: Codable, Hashable {
    var km: Double
  }

  var startedAt: Date
}
