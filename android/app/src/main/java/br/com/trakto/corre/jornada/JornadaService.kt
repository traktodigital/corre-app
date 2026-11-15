package br.com.trakto.corre.jornada

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Build
import android.os.IBinder
import android.os.Looper
import java.io.File
import java.util.Locale

/**
 * Rastreia a jornada com o app em segundo plano (ADR-0002 D1): foreground
 * service do tipo `location` + notificação fixa. Não usa
 * ACCESS_BACKGROUND_LOCATION — basta a permissão "durante o uso", porque o
 * serviço nasce com o app aberto (botão Iniciar jornada).
 *
 * Estado salvo em SharedPreferences a cada ponto aceito: se o sistema matar e
 * recriar o serviço (START_STICKY), a soma continua de onde parou.
 */
class JornadaService : Service(), LocationListener {

  private val acc = KmAcumulador()
  private var jornadaId = ""
  private var iniciadaEm = 0L
  private var simulado = false
  private var ultimaNotifMs = 0L
  private var kmNaNotif = 0.0
  private var lm: LocationManager? = null

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    val p = prefs(this)
    val id = intent?.getStringExtra(EXTRA_ID) ?: p.getString(K_ID, null)
    if (id == null) {
      stopSelf()
      return START_NOT_STICKY
    }
    jornadaId = id
    iniciadaEm = p.getLong(K_INICIO, System.currentTimeMillis())
    simulado = p.getBoolean(K_SIMULADO, false)
    acc.restaurar(
      p.getFloat(K_METROS, 0f).toDouble(),
      p.getInt(K_PONTOS, 0),
      p.getInt(K_BURACOS, 0),
      p.getFloat(K_LAT, 0f).toDouble(),
      p.getFloat(K_LNG, 0f).toDouble(),
      p.getLong(K_T, 0L),
    )

    criarCanal()
    try {
      if (Build.VERSION.SDK_INT >= 29) {
        startForeground(NOTIF_ID, notificacao(), ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION)
      } else {
        startForeground(NOTIF_ID, notificacao())
      }
      val m = getSystemService(Context.LOCATION_SERVICE) as LocationManager
      m.requestLocationUpdates(LocationManager.GPS_PROVIDER, INTERVALO_MS, DISTANCIA_M, this, Looper.getMainLooper())
      lm = m
    } catch (e: Exception) {
      // Sem permissão ou o sistema recusou iniciar em segundo plano (Android 12+).
      // A jornada segue no banco; o km fica pelo odômetro (ADR-0005 D1).
      stopSelf()
      return START_NOT_STICKY
    }
    return START_STICKY
  }

  override fun onLocationChanged(loc: Location) {
    val precisao = if (loc.hasAccuracy()) loc.accuracy else Float.MAX_VALUE
    if (!acc.adicionar(loc.latitude, loc.longitude, precisao, loc.time)) return
    val mock = if (Build.VERSION.SDK_INT >= 31) loc.isMock else @Suppress("DEPRECATION") loc.isFromMockProvider
    if (mock) simulado = true

    arquivo(this, jornadaId).appendText(
      String.format(Locale.US, "%d,%.6f,%.6f,%.0f\n", loc.time, loc.latitude, loc.longitude, precisao),
    )
    prefs(this).edit()
      .putFloat(K_METROS, acc.metros.toFloat())
      .putInt(K_PONTOS, acc.pontos)
      .putInt(K_BURACOS, acc.buracos)
      .putFloat(K_LAT, acc.ultimoLat.toFloat())
      .putFloat(K_LNG, acc.ultimoLng.toFloat())
      .putLong(K_T, acc.ultimoT)
      .putBoolean(K_SIMULADO, simulado)
      .apply()

    // Notificação a cada 0,5 km ou 1 min — não a cada ponto (bateria).
    val agora = System.currentTimeMillis()
    val km = acc.metros / 1000
    if (km - kmNaNotif >= 0.5 || agora - ultimaNotifMs >= 60_000) {
      kmNaNotif = km
      ultimaNotifMs = agora
      getSystemService(NotificationManager::class.java).notify(NOTIF_ID, notificacao())
    }
  }

  override fun onDestroy() {
    lm?.removeUpdates(this)
    lm = null
    super.onDestroy()
  }

  private fun criarCanal() {
    if (Build.VERSION.SDK_INT < 26) return
    val canal = NotificationChannel(CANAL, "Jornada em andamento", NotificationManager.IMPORTANCE_LOW)
    canal.description = "Mostra os km enquanto a jornada está aberta."
    canal.setShowBadge(false)
    getSystemService(NotificationManager::class.java).createNotificationChannel(canal)
  }

  private fun notificacao(): Notification {
    val km = String.format(Locale("pt", "BR"), "%.1f km", acc.metros / 1000)
    val abrir = packageManager.getLaunchIntentForPackage(packageName)
    val pi = PendingIntent.getActivity(this, 0, abrir, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
    @Suppress("DEPRECATION")
    val b = if (Build.VERSION.SDK_INT >= 26) Notification.Builder(this, CANAL) else Notification.Builder(this)
    b.setSmallIcon(android.R.drawable.ic_menu_mylocation)
      .setContentTitle("Jornada em andamento · $km")
      .setContentText("Pode trocar de app. Só não feche o CORRE.")
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .setShowWhen(true)
      .setWhen(iniciadaEm)
      .setUsesChronometer(true) // tempo de jornada correndo sozinho, sem atualizar
      .setContentIntent(pi)
      .setCategory(Notification.CATEGORY_NAVIGATION)
    if (Build.VERSION.SDK_INT >= 36) {
      // Android 16 "Live Update": chip na barra de status com o km.
      b.setRequestPromotedOngoing(true)
      b.setShortCriticalText(km)
    }
    return b.build()
  }

  companion object {
    const val EXTRA_ID = "jornadaId"
    const val CANAL = "jornada"
    const val NOTIF_ID = 4201
    const val INTERVALO_MS = 5_000L
    const val DISTANCIA_M = 10f

    const val K_ID = "id"
    const val K_INICIO = "iniciadaEm"
    const val K_METROS = "metros"
    const val K_PONTOS = "pontos"
    const val K_BURACOS = "buracos"
    const val K_LAT = "lat"
    const val K_LNG = "lng"
    const val K_T = "t"
    const val K_SIMULADO = "simulado"

    fun prefs(c: Context) = c.getSharedPreferences("corre_jornada", Context.MODE_PRIVATE)

    /** Trajeto bruto: uma linha por ponto aceito (epochMs,lat,lng,precisaoM). */
    fun arquivo(c: Context, id: String) = File(c.filesDir, "jornada-$id.csv")
  }
}
