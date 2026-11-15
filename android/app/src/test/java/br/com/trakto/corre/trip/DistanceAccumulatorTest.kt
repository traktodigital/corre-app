package br.com.trakto.corre.trip

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class DistanceAccumulatorTest {
  private val lat0 = -16.68
  private val lng0 = -49.25

  @Test
  fun sumsRealRouteAndIgnoresNoise() {
    val a = DistanceAccumulator()
    assertTrue(a.add(lat0, lng0, 8f, 0))
    for (i in 1..10) assertTrue(a.add(lat0 + i * 0.001, lng0, 8f, i * 10_000L))
    assertEquals(1.11, a.meters / 1000, 0.01)
    assertEquals(11, a.points)
    assertEquals(0, a.gaps)
  }

  @Test
  fun dropsPoorAccuracyJitterAndJumps() {
    val a = DistanceAccumulator()
    a.add(lat0, lng0, 8f, 0)
    assertFalse("80 m accuracy", a.add(lat0 + 0.001, lng0, 80f, 10_000))
    assertFalse("standing still, 3 m jitter", a.add(lat0 + 0.00003, lng0, 8f, 20_000))
    assertFalse("11 km jump in 10 s", a.add(lat0 + 0.1, lng0, 8f, 30_000))
    assertEquals(0.0, a.meters, 0.0)
    assertTrue(a.add(lat0 + 0.0002, lng0, 8f, 40_000))
    assertEquals(22.2, a.meters, 0.5)
  }

  @Test
  fun countsGapWhenNoPointsArrive() {
    val a = DistanceAccumulator()
    a.add(lat0, lng0, 8f, 0)
    assertTrue(a.add(lat0 + 0.01, lng0, 8f, 5 * 60_000L))
    assertEquals(1, a.gaps)
  }

  @Test
  fun restoresAfterServiceRestart() {
    val a = DistanceAccumulator()
    a.restore(5000.0, 40, 1, lat0, lng0, 1_000_000)
    assertTrue(a.add(lat0 + 0.001, lng0, 8f, 1_010_000))
    assertEquals(5111.0, a.meters, 1.0)
  }

  @Test
  fun restoringEmptyTripForgetsPreviousLastPoint() {
    val a = DistanceAccumulator()
    a.add(lat0, lng0, 8f, 0)
    a.restore(0.0, 0, 0, 0.0, 0.0, 0)
    assertTrue(a.add(lat0 + 0.01, lng0, 8f, 10 * 60_000L))
    assertEquals(0.0, a.meters, 0.0)
    assertEquals(1, a.points)
    assertEquals(0, a.gaps)
  }
}
