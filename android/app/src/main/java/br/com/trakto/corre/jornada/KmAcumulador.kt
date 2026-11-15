package br.com.trakto.corre.jornada

import kotlin.math.asin
import kotlin.math.cos
import kotlin.math.pow
import kotlin.math.sin
import kotlin.math.sqrt

/**
 * Filtro + soma de km no aparelho (ADR-0002 D2/D3). Mesma regra do iOS
 * (ios/CorreApp/Jornada/JornadaGps.swift) — mudou aqui, muda lá.
 *
 * - Ponto com precisão pior que 30 m é descartado.
 * - Deslocamento < 10 m não soma (GPS "tremendo" parado no semáforo) e o
 *   último ponto não anda: movimento lento acumula até passar de 10 m.
 * - Salto acima de 120 km/h é GPS pulando, não moto: descarta.
 * - Intervalo > 2 min entre pontos aceitos conta como buraco (app morto, túnel).
 */
class KmAcumulador {
  var metros = 0.0
    private set
  var pontos = 0
    private set
  var buracos = 0
    private set

  private var ultLat = 0.0
  private var ultLng = 0.0
  private var ultT = 0L
  private var temUltimo = false

  /** Devolve true se o ponto entrou no trajeto. */
  fun adicionar(lat: Double, lng: Double, precisaoM: Float, tMs: Long): Boolean {
    if (precisaoM > PRECISAO_MAX_M) return false
    if (!temUltimo) {
      marcar(lat, lng, tMs)
      return true
    }
    val dt = (tMs - ultT) / 1000.0
    if (dt <= 0) return false
    val d = distanciaM(ultLat, ultLng, lat, lng)
    if (d < DESLOC_MIN_M) return false
    if (d / dt > VEL_MAX_MS) return false
    if (dt > BURACO_S) buracos++
    metros += d
    marcar(lat, lng, tMs)
    return true
  }

  /** Volta o estado salvo (serviço reiniciado pelo sistema). */
  fun restaurar(metros: Double, pontos: Int, buracos: Int, lat: Double, lng: Double, tMs: Long) {
    this.metros = metros
    this.pontos = pontos
    this.buracos = buracos
    if (pontos > 0) {
      ultLat = lat
      ultLng = lng
      ultT = tMs
      temUltimo = true
    }
  }

  val ultimoLat get() = ultLat
  val ultimoLng get() = ultLng
  val ultimoT get() = ultT

  private fun marcar(lat: Double, lng: Double, tMs: Long) {
    ultLat = lat
    ultLng = lng
    ultT = tMs
    temUltimo = true
    pontos++
  }

  companion object {
    const val PRECISAO_MAX_M = 30f
    const val DESLOC_MIN_M = 10.0
    const val VEL_MAX_MS = 120 / 3.6
    const val BURACO_S = 120.0

    /** Haversine em metros. */
    fun distanciaM(lat1: Double, lng1: Double, lat2: Double, lng2: Double): Double {
      val r = 6_371_000.0
      val dLat = Math.toRadians(lat2 - lat1)
      val dLng = Math.toRadians(lng2 - lng1)
      val a = sin(dLat / 2).pow(2) +
        cos(Math.toRadians(lat1)) * cos(Math.toRadians(lat2)) * sin(dLng / 2).pow(2)
      return 2 * r * asin(sqrt(a))
    }
  }
}
