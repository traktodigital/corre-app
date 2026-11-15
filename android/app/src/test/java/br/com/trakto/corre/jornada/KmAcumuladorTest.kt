package br.com.trakto.corre.jornada

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class KmAcumuladorTest {
  // ~111 m por 0,001° de latitude.
  private val lat0 = -16.68
  private val lng0 = -49.25

  @Test
  fun somaTrajetoRealEIgnoraRuido() {
    val a = KmAcumulador()
    assertTrue(a.adicionar(lat0, lng0, 8f, 0))
    // 10 pontos andando 111 m a cada 10 s (~40 km/h): ~1,11 km.
    for (i in 1..10) assertTrue(a.adicionar(lat0 + i * 0.001, lng0, 8f, i * 10_000L))
    assertEquals(1.11, a.metros / 1000, 0.01)
    assertEquals(11, a.pontos)
    assertEquals(0, a.buracos)
  }

  @Test
  fun descartaPrecisaoRuimTremidaESalto() {
    val a = KmAcumulador()
    a.adicionar(lat0, lng0, 8f, 0)
    assertFalse("precisão de 80 m", a.adicionar(lat0 + 0.001, lng0, 80f, 10_000))
    assertFalse("parado, tremendo 3 m", a.adicionar(lat0 + 0.00003, lng0, 8f, 20_000))
    assertFalse("pulo de 11 km em 10 s", a.adicionar(lat0 + 0.1, lng0, 8f, 30_000))
    assertEquals(0.0, a.metros, 0.0)
    // Andou devagar (tremidas não moveram o último ponto): soma quando passa de 10 m.
    assertTrue(a.adicionar(lat0 + 0.0002, lng0, 8f, 40_000))
    assertEquals(22.2, a.metros, 0.5)
  }

  @Test
  fun contaBuracoQuandoFicaSemPonto() {
    val a = KmAcumulador()
    a.adicionar(lat0, lng0, 8f, 0)
    assertTrue(a.adicionar(lat0 + 0.01, lng0, 8f, 5 * 60_000L)) // 1,1 km em 5 min
    assertEquals(1, a.buracos)
  }

  @Test
  fun restauraDepoisDoServicoReiniciar() {
    val a = KmAcumulador()
    a.restaurar(5000.0, 40, 1, lat0, lng0, 1_000_000)
    assertTrue(a.adicionar(lat0 + 0.001, lng0, 8f, 1_010_000))
    assertEquals(5111.0, a.metros, 1.0)
  }
}
