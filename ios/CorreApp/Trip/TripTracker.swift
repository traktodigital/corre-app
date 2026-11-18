import ActivityKit
import CoreLocation
import Foundation
import UIKit

struct DistanceAccumulator: Codable {
  static let maxAccuracyM = 30.0
  static let minDisplacementM = 10.0
  static let maxSpeedMs = 120 / 3.6
  static let gapS = 120.0
  static let reanchorAfterJumps = 3

  var meters = 0.0
  var points = 0
  var gaps = 0
  var lastLat = 0.0
  var lastLng = 0.0
  var lastTime = 0.0
  var hasLast = false
  var jumps = 0

  enum CodingKeys: String, CodingKey {
    case meters = "metros"
    case points = "pontos"
    case gaps = "buracos"
    case lastLat = "ultLat"
    case lastLng = "ultLng"
    case lastTime = "ultT"
    case hasLast = "temUltimo"
  }

  mutating func add(lat: Double, lng: Double, accuracyM: Double, time: Double) -> Bool {
    if accuracyM < 0 || accuracyM > Self.maxAccuracyM { return false }
    if !hasLast {
      mark(lat, lng, time)
      return true
    }
    let dt = time - lastTime
    if dt <= 0 { return false }
    let d = Self.distanceM(lastLat, lastLng, lat, lng)
    if d < Self.minDisplacementM { return false }
    if d / dt > Self.maxSpeedMs {
      jumps += 1
      if jumps < Self.reanchorAfterJumps { return false }
      jumps = 0
      gaps += 1
      mark(lat, lng, time)
      return true
    }
    jumps = 0
    if dt > Self.gapS { gaps += 1 }
    meters += d
    mark(lat, lng, time)
    return true
  }

  private mutating func mark(_ lat: Double, _ lng: Double, _ time: Double) {
    lastLat = lat
    lastLng = lng
    lastTime = time
    hasLast = true
    points += 1
  }

  static func distanceM(_ lat1: Double, _ lng1: Double, _ lat2: Double, _ lng2: Double) -> Double {
    let earthRadiusM = 6_371_000.0
    let dLat = (lat2 - lat1) * .pi / 180
    let dLng = (lng2 - lng1) * .pi / 180
    let a = pow(sin(dLat / 2), 2) + cos(lat1 * .pi / 180) * cos(lat2 * .pi / 180) * pow(sin(dLng / 2), 2)
    return 2 * earthRadiusM * asin(sqrt(a))
  }
}

struct TripState: Codable {
  var tripId: String
  var startedAt: Date
  var accumulator = DistanceAccumulator()
  var mocked = false
  var activityCreatedAt: Date?

  enum CodingKeys: String, CodingKey {
    case tripId = "jornadaId"
    case startedAt = "iniciadaEm"
    case accumulator = "acc"
    case mocked = "simulado"
    case activityCreatedAt = "atividadeCriadaEm"
  }
}

@objc(TripTracker)
final class TripTracker: NSObject, CLLocationManagerDelegate {
  private static let storageKey = "corre.jornada"
  private static let closedKey = "corre.jornada.encerrada"
  private static let activityStaleAfter: TimeInterval = 15 * 60
  private static let activityMaxAge: TimeInterval = 7.5 * 3600
  private static let activityEveryKm = 0.5
  private static let activityEverySeconds: TimeInterval = 60

  private let manager = CLLocationManager()
  private var state: TripState?
  private var updating = false
  private var pendingPermission: [(Any?) -> Void] = []
  private var lastActivityUpdate = Date.distantPast
  private var activityKm = 0.0
  private var activity: Any?

  @objc static func requiresMainQueueSetup() -> Bool { true }
  @objc let methodQueue = DispatchQueue.main

  override init() {
    super.init()
    manager.delegate = self
    manager.desiredAccuracy = kCLLocationAccuracyBest
    manager.distanceFilter = 10
    manager.activityType = .otherNavigation
    manager.pausesLocationUpdatesAutomatically = false
    if let data = UserDefaults.standard.data(forKey: Self.storageKey) {
      state = try? JSONDecoder().decode(TripState.self, from: data)
    }
  }

  @objc(requestPermission:rejecter:)
  func requestPermission(_ resolve: @escaping (Any?) -> Void,
                         rejecter reject: @escaping (String?, String?, Error?) -> Void) {
    if manager.authorizationStatus == .notDetermined {
      pendingPermission.append(resolve)
      manager.requestWhenInUseAuthorization()
      return
    }
    resolve(Self.permissionText(manager.authorizationStatus))
  }

  @objc(getPermissionStatus:rejecter:)
  func getPermissionStatus(_ resolve: @escaping (Any?) -> Void,
                           rejecter reject: @escaping (String?, String?, Error?) -> Void) {
    resolve(Self.permissionText(manager.authorizationStatus))
  }

  @objc(start:resolver:rejecter:)
  func start(_ tripId: String,
             resolver resolve: @escaping (Any?) -> Void,
             rejecter reject: @escaping (String?, String?, Error?) -> Void) {
    guard Self.isAuthorized(manager.authorizationStatus) else {
      reject("permission_denied", "Permissão de localização não concedida.", nil)
      return
    }
    if UserDefaults.standard.string(forKey: Self.closedKey) == tripId {
      reject("trip_closed", "Jornada já encerrada.", nil)
      return
    }
    if state?.tripId != tripId {
      state = TripState(tripId: tripId, startedAt: Date())
      save()
    }
    if Self.hasBackgroundLocationMode {
      manager.allowsBackgroundLocationUpdates = true
      manager.showsBackgroundLocationIndicator = true
    }
    manager.startUpdatingLocation()
    updating = true
    startActivity()
    resolve(nil)
  }

  @objc(getState:rejecter:)
  func getState(_ resolve: @escaping (Any?) -> Void,
                rejecter reject: @escaping (String?, String?, Error?) -> Void) {
    resolve(stateMap())
  }

  @objc(getLastLocation:rejecter:)
  func getLastLocation(_ resolve: @escaping (Any?) -> Void,
                       rejecter reject: @escaping (String?, String?, Error?) -> Void) {
    guard Self.isAuthorized(manager.authorizationStatus), let location = manager.location else {
      resolve(nil)
      return
    }
    resolve([
      "lat": location.coordinate.latitude,
      "lng": location.coordinate.longitude,
      "accuracy": location.horizontalAccuracy,
      "time": location.timestamp.timeIntervalSince1970 * 1000,
    ])
  }

  @objc(stop:rejecter:)
  func stop(_ resolve: @escaping (Any?) -> Void,
            rejecter reject: @escaping (String?, String?, Error?) -> Void) {
    let result = stateMap()
    manager.stopUpdatingLocation()
    updating = false
    if manager.allowsBackgroundLocationUpdates {
      manager.allowsBackgroundLocationUpdates = false
    }
    endActivity()
    if let closedId = state?.tripId {
      UserDefaults.standard.set(closedId, forKey: Self.closedKey)
    }
    state = nil
    UserDefaults.standard.removeObject(forKey: Self.storageKey)
    resolve(result)
  }

  func locationManagerDidChangeAuthorization(_ m: CLLocationManager) {
    guard m.authorizationStatus != .notDetermined else { return }
    let status = Self.permissionText(m.authorizationStatus)
    pendingPermission.forEach { $0(status) }
    pendingPermission.removeAll()
  }

  func locationManager(_ m: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
    guard var current = state else { return }
    var changed = false
    for location in locations {
      let lat = location.coordinate.latitude
      let lng = location.coordinate.longitude
      guard current.accumulator.add(lat: lat, lng: lng, accuracyM: location.horizontalAccuracy,
                                    time: location.timestamp.timeIntervalSince1970) else { continue }
      if location.sourceInformation?.isSimulatedBySoftware == true { current.mocked = true }
      Self.append(current.tripId, String(format: "%.0f,%.6f,%.6f,%.0f\n",
                                         location.timestamp.timeIntervalSince1970 * 1000, lat, lng,
                                         location.horizontalAccuracy))
      changed = true
    }
    guard changed else { return }
    state = current
    save()
    let km = current.accumulator.meters / 1000
    let dueByDistance = km - activityKm >= Self.activityEveryKm
    let dueByTime = Date().timeIntervalSince(lastActivityUpdate) >= Self.activityEverySeconds
    if dueByDistance || dueByTime {
      activityKm = km
      lastActivityUpdate = Date()
      updateActivity(km)
    }
  }

  private func startActivity(reuse: Bool = true) {
    guard #available(iOS 16.2, *) else { return }
    guard ActivityAuthorizationInfo().areActivitiesEnabled, let current = state else { return }
    if reuse, let existing = Activity<TripActivityAttributes>.activities.first(where: { $0.activityState == .active }) {
      activity = existing
      return
    }
    let content = ActivityContent(state: TripActivityAttributes.ContentState(km: current.accumulator.meters / 1000),
                                  staleDate: Date().addingTimeInterval(Self.activityStaleAfter))
    activity = try? Activity.request(attributes: TripActivityAttributes(startedAt: current.startedAt),
                                     content: content, pushType: nil)
    state?.activityCreatedAt = Date()
    save()
  }

  private func updateActivity(_ km: Double) {
    guard #available(iOS 16.2, *) else { return }
    if let createdAt = state?.activityCreatedAt, Date().timeIntervalSince(createdAt) > Self.activityMaxAge,
       UIApplication.shared.applicationState == .active {
      endActivity()
      startActivity(reuse: false)
      return
    }
    guard ActivityAuthorizationInfo().areActivitiesEnabled,
          let current = activity as? Activity<TripActivityAttributes> else { return }
    let content = ActivityContent(state: TripActivityAttributes.ContentState(km: km),
                                  staleDate: Date().addingTimeInterval(Self.activityStaleAfter))
    Task { await current.update(content) }
  }

  private func endActivity() {
    guard #available(iOS 16.2, *) else { return }
    let all = Activity<TripActivityAttributes>.activities
    Task { for item in all { await item.end(nil, dismissalPolicy: .immediate) } }
    activity = nil
  }

  private func save() {
    guard let current = state, let data = try? JSONEncoder().encode(current) else { return }
    UserDefaults.standard.set(data, forKey: Self.storageKey)
  }

  private func stateMap() -> [String: Any]? {
    guard let current = state else { return nil }
    return [
      "active": updating,
      "tripId": current.tripId,
      "km": current.accumulator.meters / 1000,
      "points": current.accumulator.points,
      "gaps": current.accumulator.gaps,
      "mocked": current.mocked,
      "startedAt": current.startedAt.timeIntervalSince1970 * 1000,
      "file": Self.routeFile(current.tripId).path,
    ]
  }

  private static var hasBackgroundLocationMode: Bool {
    let modes = Bundle.main.object(forInfoDictionaryKey: "UIBackgroundModes") as? [String]
    return modes?.contains("location") ?? false
  }

  private static func isAuthorized(_ status: CLAuthorizationStatus) -> Bool {
    status == .authorizedWhenInUse || status == .authorizedAlways
  }

  private static func routeFile(_ tripId: String) -> URL {
    FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
      .appendingPathComponent("jornada-\(tripId).csv")
  }

  private static func append(_ tripId: String, _ line: String) {
    let url = routeFile(tripId)
    let data = Data(line.utf8)
    if let handle = try? FileHandle(forWritingTo: url) {
      defer { try? handle.close() }
      _ = try? handle.seekToEnd()
      try? handle.write(contentsOf: data)
    } else {
      try? FileManager.default.createDirectory(at: url.deletingLastPathComponent(),
                                               withIntermediateDirectories: true)
      try? data.write(to: url)
    }
  }

  private static func permissionText(_ status: CLAuthorizationStatus) -> String {
    switch status {
    case .authorizedWhenInUse, .authorizedAlways: return "granted"
    case .notDetermined: return "denied"
    default: return "blocked"
    }
  }
}
