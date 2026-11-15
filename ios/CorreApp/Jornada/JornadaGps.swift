import ActivityKit
import CoreLocation
import Foundation
import UIKit

/// Filtro + soma de km. Mesma regra do Android (KmAcumulador.kt) — mudou lá, muda aqui.
/// Precisão > 30 m descarta; < 10 m não soma; salto > 120 km/h descarta; > 2 min sem ponto = buraco.
struct KmAcumulador: Codable {
  static let precisaoMaxM = 30.0
  static let deslocMinM = 10.0
  static let velMaxMs = 120 / 3.6
  static let buracoS = 120.0

  var metros = 0.0
  var pontos = 0
  var buracos = 0
  var ultLat = 0.0
  var ultLng = 0.0
  var ultT = 0.0 // epoch em segundos
  var temUltimo = false

  mutating func adicionar(lat: Double, lng: Double, precisaoM: Double, t: Double) -> Bool {
    if precisaoM < 0 || precisaoM > Self.precisaoMaxM { return false }
    if !temUltimo {
      marcar(lat, lng, t)
      return true
    }
    let dt = t - ultT
    if dt <= 0 { return false }
    let d = Self.distanciaM(ultLat, ultLng, lat, lng)
    if d < Self.deslocMinM { return false }
    if d / dt > Self.velMaxMs { return false }
    if dt > Self.buracoS { buracos += 1 }
    metros += d
    marcar(lat, lng, t)
    return true
  }

  private mutating func marcar(_ lat: Double, _ lng: Double, _ t: Double) {
    ultLat = lat
    ultLng = lng
    ultT = t
    temUltimo = true
    pontos += 1
  }

  static func distanciaM(_ lat1: Double, _ lng1: Double, _ lat2: Double, _ lng2: Double) -> Double {
    let r = 6_371_000.0
    let dLat = (lat2 - lat1) * .pi / 180
    let dLng = (lng2 - lng1) * .pi / 180
    let a = pow(sin(dLat / 2), 2) + cos(lat1 * .pi / 180) * cos(lat2 * .pi / 180) * pow(sin(dLng / 2), 2)
    return 2 * r * asin(sqrt(a))
  }
}

struct EstadoJornada: Codable {
  var jornadaId: String
  var iniciadaEm: Date
  var acc = KmAcumulador()
  var simulado = false
  var atividadeCriadaEm: Date?
}

/// GPS da jornada (ADR-0002 D1): permissão "Durante o uso" + UIBackgroundModes
/// `location`. Continua quando o entregador troca de app (indicador azul).
/// Se ele FECHAR o app (arrastar), o iOS para o GPS e não religa — ao abrir de
/// novo, o JS chama iniciar(mesmoId) e a soma continua (o intervalo vira buraco).
@objc(JornadaGps)
final class JornadaGps: NSObject, CLLocationManagerDelegate {
  private static let chave = "corre.jornada"
  private let manager = CLLocationManager()
  private var estadoAtual: EstadoJornada?
  private var aguardandoPermissao: [(Any?) -> Void] = []
  private var ultimaAtualizacao = Date.distantPast
  private var kmNaAtividade = 0.0
  private var atividade: Any? // Activity<JornadaAttributes> (iOS 16.2+)

  @objc static func requiresMainQueueSetup() -> Bool { true }
  @objc let methodQueue = DispatchQueue.main // CLLocationManager precisa de run loop

  override init() {
    super.init()
    manager.delegate = self
    manager.desiredAccuracy = kCLLocationAccuracyBest
    manager.distanceFilter = 10
    manager.activityType = .otherNavigation
    manager.pausesLocationUpdatesAutomatically = false
    if let d = UserDefaults.standard.data(forKey: Self.chave) {
      estadoAtual = try? JSONDecoder().decode(EstadoJornada.self, from: d)
    }
  }

  // MARK: - API (igual ao Android)

  @objc(pedirPermissao:rejecter:)
  func pedirPermissao(_ resolve: @escaping (Any?) -> Void,
                      rejecter reject: @escaping (String?, String?, Error?) -> Void) {
    if manager.authorizationStatus == .notDetermined {
      aguardandoPermissao.append(resolve)
      manager.requestWhenInUseAuthorization() // nunca "Sempre" (ADR-0002 D1)
      return
    }
    resolve(Self.texto(manager.authorizationStatus))
  }

  @objc(iniciar:resolver:rejecter:)
  func iniciar(_ jornadaId: String,
               resolver resolve: @escaping (Any?) -> Void,
               rejecter reject: @escaping (String?, String?, Error?) -> Void) {
    let s = manager.authorizationStatus
    guard s == .authorizedWhenInUse || s == .authorizedAlways else {
      reject("sem_permissao", "Permissão de localização não concedida.", nil)
      return
    }
    // Mesma jornada: retoma (idempotente). Outra: zera.
    if estadoAtual?.jornadaId != jornadaId {
      estadoAtual = EstadoJornada(jornadaId: jornadaId, iniciadaEm: Date())
      salvar()
    }
    manager.allowsBackgroundLocationUpdates = true // exige UIBackgroundModes: location
    manager.showsBackgroundLocationIndicator = true
    manager.startUpdatingLocation()
    iniciarAtividade()
    resolve(nil)
  }

  @objc(estado:rejecter:)
  func estado(_ resolve: @escaping (Any?) -> Void,
              rejecter reject: @escaping (String?, String?, Error?) -> Void) {
    resolve(mapa())
  }

  /// Para o GPS e devolve o resultado final. O arquivo do trajeto fica para upload.
  @objc(encerrar:rejecter:)
  func encerrar(_ resolve: @escaping (Any?) -> Void,
                rejecter reject: @escaping (String?, String?, Error?) -> Void) {
    let r = mapa()
    manager.stopUpdatingLocation()
    manager.allowsBackgroundLocationUpdates = false
    encerrarAtividade()
    estadoAtual = nil
    UserDefaults.standard.removeObject(forKey: Self.chave)
    resolve(r)
  }

  // MARK: - CLLocationManagerDelegate

  func locationManagerDidChangeAuthorization(_ m: CLLocationManager) {
    guard m.authorizationStatus != .notDetermined else { return }
    let r = Self.texto(m.authorizationStatus)
    aguardandoPermissao.forEach { $0(r) }
    aguardandoPermissao.removeAll()
  }

  func locationManager(_ m: CLLocationManager, didUpdateLocations locs: [CLLocation]) {
    guard var e = estadoAtual else { return }
    var mudou = false
    for l in locs {
      let lat = l.coordinate.latitude
      let lng = l.coordinate.longitude
      guard e.acc.adicionar(lat: lat, lng: lng, precisaoM: l.horizontalAccuracy,
                            t: l.timestamp.timeIntervalSince1970) else { continue }
      if l.sourceInformation?.isSimulatedBySoftware == true { e.simulado = true }
      Self.anexar(e.jornadaId, String(format: "%.0f,%.6f,%.6f,%.0f\n",
                                      l.timestamp.timeIntervalSince1970 * 1000, lat, lng, l.horizontalAccuracy))
      mudou = true
    }
    guard mudou else { return }
    estadoAtual = e
    salvar()
    // Live Activity a cada 0,5 km ou 1 min — o sistema limita atualização frequente.
    let km = e.acc.metros / 1000
    if km - kmNaAtividade >= 0.5 || Date().timeIntervalSince(ultimaAtualizacao) >= 60 {
      kmNaAtividade = km
      ultimaAtualizacao = Date()
      atualizarAtividade(km)
    }
  }

  // MARK: - Live Activity (tela bloqueada + Dynamic Island)

  private func iniciarAtividade(reaproveitar: Bool = true) {
    guard #available(iOS 16.2, *) else { return }
    guard ActivityAuthorizationInfo().areActivitiesEnabled, let e = estadoAtual else { return }
    if reaproveitar, let a = Activity<JornadaAttributes>.activities.first(where: { $0.activityState == .active }) {
      atividade = a
      return
    }
    let conteudo = ActivityContent(state: JornadaAttributes.ContentState(km: e.acc.metros / 1000),
                                   staleDate: Date().addingTimeInterval(15 * 60))
    atividade = try? Activity.request(attributes: JornadaAttributes(iniciadaEm: e.iniciadaEm),
                                      content: conteudo, pushType: nil)
    estadoAtual?.atividadeCriadaEm = Date()
    salvar()
  }

  private func atualizarAtividade(_ km: Double) {
    guard #available(iOS 16.2, *) else { return }
    // Live Activity vive no máximo ~8 h. Só dá pra criar outra com o app em
    // primeiro plano; em segundo plano segue a atual até o sistema encerrar.
    if let criada = estadoAtual?.atividadeCriadaEm, Date().timeIntervalSince(criada) > 7.5 * 3600,
       UIApplication.shared.applicationState == .active {
      encerrarAtividade()
      iniciarAtividade(reaproveitar: false)
      return
    }
    guard let a = atividade as? Activity<JornadaAttributes> else { return }
    // staleDate: sem atualização em 15 min o widget mostra "sem sinal".
    let c = ActivityContent(state: JornadaAttributes.ContentState(km: km),
                            staleDate: Date().addingTimeInterval(15 * 60))
    Task { await a.update(c) }
  }

  private func encerrarAtividade() {
    guard #available(iOS 16.2, *) else { return }
    let todas = Activity<JornadaAttributes>.activities
    Task { for a in todas { await a.end(nil, dismissalPolicy: .immediate) } }
    atividade = nil
  }

  // MARK: - Persistência

  private func salvar() {
    guard let e = estadoAtual, let d = try? JSONEncoder().encode(e) else { return }
    UserDefaults.standard.set(d, forKey: Self.chave)
  }

  private func mapa() -> [String: Any]? {
    guard let e = estadoAtual else { return nil }
    return [
      "ativa": true,
      "jornadaId": e.jornadaId,
      "km": e.acc.metros / 1000,
      "pontos": e.acc.pontos,
      "buracos": e.acc.buracos,
      "simulado": e.simulado,
      "iniciadaEm": e.iniciadaEm.timeIntervalSince1970 * 1000,
      "arquivo": Self.arquivo(e.jornadaId).path,
    ]
  }

  /// Trajeto bruto: uma linha por ponto aceito (epochMs,lat,lng,precisaoM).
  private static func arquivo(_ id: String) -> URL {
    FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
      .appendingPathComponent("jornada-\(id).csv")
  }

  private static func anexar(_ id: String, _ linha: String) {
    let url = arquivo(id)
    let dados = Data(linha.utf8)
    if let h = try? FileHandle(forWritingTo: url) {
      h.seekToEndOfFile()
      h.write(dados)
      try? h.close()
    } else {
      try? FileManager.default.createDirectory(at: url.deletingLastPathComponent(),
                                               withIntermediateDirectories: true)
      try? dados.write(to: url)
    }
  }

  private static func texto(_ s: CLAuthorizationStatus) -> String {
    switch s {
    case .authorizedWhenInUse, .authorizedAlways: return "permitido"
    case .notDetermined: return "negado"
    default: return "bloqueado" // negado/restrito: só nos Ajustes do iPhone
    }
  }
}
