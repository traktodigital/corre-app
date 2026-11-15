package br.com.trakto.corre.jornada

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableMap
import com.facebook.react.uimanager.ViewManager

/**
 * Ponte JS ↔ GPS da jornada. Mesma API do iOS (JornadaGps.swift):
 * iniciar(jornadaId), estado(), encerrar(). A permissão no Android é pedida
 * pelo JS com PermissionsAndroid (src/features/jornada/gps.ts).
 */
class JornadaGpsModule(private val ctx: ReactApplicationContext) : ReactContextBaseJavaModule(ctx) {

  override fun getName() = "JornadaGps"

  @ReactMethod
  fun iniciar(jornadaId: String, promise: Promise) {
    if (ctx.checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
      promise.reject("sem_permissao", "Permissão de localização não concedida.")
      return
    }
    val p = JornadaService.prefs(ctx)
    // Mesma jornada: só garante o serviço vivo (idempotente). Outra: zera.
    if (p.getString(JornadaService.K_ID, null) != jornadaId) {
      p.edit().clear()
        .putString(JornadaService.K_ID, jornadaId)
        .putLong(JornadaService.K_INICIO, System.currentTimeMillis())
        .apply()
    }
    val i = Intent(ctx, JornadaService::class.java).putExtra(JornadaService.EXTRA_ID, jornadaId)
    try {
      if (Build.VERSION.SDK_INT >= 26) ctx.startForegroundService(i) else ctx.startService(i)
      promise.resolve(null)
    } catch (e: Exception) {
      promise.reject("nao_iniciou", e.message, e)
    }
  }

  @ReactMethod
  fun estado(promise: Promise) {
    promise.resolve(lerEstado())
  }

  /** Para o GPS e devolve o resultado final. O arquivo do trajeto fica para upload. */
  @ReactMethod
  fun encerrar(promise: Promise) {
    val r = lerEstado()
    ctx.stopService(Intent(ctx, JornadaService::class.java))
    JornadaService.prefs(ctx).edit().clear().apply()
    promise.resolve(r)
  }

  private fun lerEstado(): WritableMap? {
    val p = JornadaService.prefs(ctx)
    val id = p.getString(JornadaService.K_ID, null) ?: return null
    return Arguments.createMap().apply {
      putBoolean("ativa", true)
      putString("jornadaId", id)
      putDouble("km", p.getFloat(JornadaService.K_METROS, 0f) / 1000.0)
      putInt("pontos", p.getInt(JornadaService.K_PONTOS, 0))
      putInt("buracos", p.getInt(JornadaService.K_BURACOS, 0))
      putBoolean("simulado", p.getBoolean(JornadaService.K_SIMULADO, false))
      putDouble("iniciadaEm", p.getLong(JornadaService.K_INICIO, 0L).toDouble())
      putString("arquivo", JornadaService.arquivo(ctx, id).absolutePath)
    }
  }
}

class JornadaPackage : ReactPackage {
  override fun createNativeModules(ctx: ReactApplicationContext): List<NativeModule> =
    listOf(JornadaGpsModule(ctx))

  override fun createViewManagers(ctx: ReactApplicationContext): List<ViewManager<*, *>> =
    emptyList()
}
