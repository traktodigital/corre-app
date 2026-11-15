package br.com.trakto.corre.trip

import kotlin.math.asin
import kotlin.math.cos
import kotlin.math.pow
import kotlin.math.sin
import kotlin.math.sqrt

class DistanceAccumulator {
  var meters = 0.0
    private set
  var points = 0
    private set
  var gaps = 0
    private set
  var lastLat = 0.0
    private set
  var lastLng = 0.0
    private set
  var lastTimeMs = 0L
    private set

  private var hasLast = false

  fun add(lat: Double, lng: Double, accuracyM: Float, timeMs: Long): Boolean {
    if (accuracyM > MAX_ACCURACY_M) return false
    if (!hasLast) {
      mark(lat, lng, timeMs)
      return true
    }
    val dt = (timeMs - lastTimeMs) / 1000.0
    if (dt <= 0) return false
    val d = distanceM(lastLat, lastLng, lat, lng)
    if (d < MIN_DISPLACEMENT_M) return false
    if (d / dt > MAX_SPEED_MS) return false
    if (dt > GAP_S) gaps++
    meters += d
    mark(lat, lng, timeMs)
    return true
  }

  fun restore(meters: Double, points: Int, gaps: Int, lat: Double, lng: Double, timeMs: Long) {
    this.meters = meters
    this.points = points
    this.gaps = gaps
    hasLast = points > 0
    lastLat = if (hasLast) lat else 0.0
    lastLng = if (hasLast) lng else 0.0
    lastTimeMs = if (hasLast) timeMs else 0L
  }

  private fun mark(lat: Double, lng: Double, timeMs: Long) {
    lastLat = lat
    lastLng = lng
    lastTimeMs = timeMs
    hasLast = true
    points++
  }

  companion object {
    const val MAX_ACCURACY_M = 30f
    const val MIN_DISPLACEMENT_M = 10.0
    const val MAX_SPEED_MS = 120 / 3.6
    const val GAP_S = 120.0

    private const val EARTH_RADIUS_M = 6_371_000.0

    fun distanceM(lat1: Double, lng1: Double, lat2: Double, lng2: Double): Double {
      val dLat = Math.toRadians(lat2 - lat1)
      val dLng = Math.toRadians(lng2 - lng1)
      val a = sin(dLat / 2).pow(2) +
        cos(Math.toRadians(lat1)) * cos(Math.toRadians(lat2)) * sin(dLng / 2).pow(2)
      return 2 * EARTH_RADIUS_M * asin(sqrt(a))
    }
  }
}
