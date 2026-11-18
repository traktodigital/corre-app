package br.com.trakto.corre.trip

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.content.pm.ServiceInfo
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Build
import android.os.Bundle
import android.os.IBinder
import android.os.Looper
import br.com.trakto.corre.R
import java.io.File
import java.util.Locale

class TripTrackerService : Service(), LocationListener {

  private val accumulator = DistanceAccumulator()
  private var tripId = ""
  private var startedAt = System.currentTimeMillis()
  private var mocked = false
  private var lastNotificationMs = 0L
  private var notifiedKm = 0.0
  private var locationManager: LocationManager? = null

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (!enterForeground()) {
      stopSelf()
      return START_NOT_STICKY
    }
    val prefs = prefs(this)
    val id = intent?.getStringExtra(EXTRA_TRIP_ID) ?: prefs.getString(K_ID, null)
    if (id == null) {
      leave()
      return START_NOT_STICKY
    }
    restore(prefs, id)
    refreshNotification()
    if (!requestLocationUpdates()) {
      leave()
      return START_NOT_STICKY
    }
    running = true
    return START_STICKY
  }

  override fun onLocationChanged(location: Location) {
    val accuracy = if (location.hasAccuracy()) location.accuracy else Float.MAX_VALUE
    if (!accumulator.add(location.latitude, location.longitude, accuracy, location.time)) return
    val isMock = if (Build.VERSION.SDK_INT >= 31) location.isMock else @Suppress("DEPRECATION") location.isFromMockProvider
    if (isMock) mocked = true
    appendPoint(location, accuracy)
    persist()
    val now = System.currentTimeMillis()
    val km = accumulator.meters / 1000
    if (km - notifiedKm >= NOTIFY_EVERY_KM || now - lastNotificationMs >= NOTIFY_EVERY_MS) {
      notifiedKm = km
      lastNotificationMs = now
      refreshNotification()
    }
  }

  override fun onProviderEnabled(provider: String) {}

  override fun onProviderDisabled(provider: String) {}

  @Deprecated("Deprecated in Java")
  override fun onStatusChanged(provider: String?, status: Int, extras: Bundle?) {}

  override fun onDestroy() {
    running = false
    try {
      locationManager?.removeUpdates(this)
    } catch (e: Exception) {
    }
    locationManager = null
    super.onDestroy()
  }

  private fun enterForeground(): Boolean =
    try {
      createChannel()
      val notification = buildNotification()
      if (Build.VERSION.SDK_INT >= 29) {
        startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION)
      } else {
        startForeground(NOTIFICATION_ID, notification)
      }
      true
    } catch (e: Exception) {
      false
    }

  private fun leave() {
    try {
      stopForeground(STOP_FOREGROUND_REMOVE)
    } catch (e: Exception) {
    }
    stopSelf()
  }

  private fun restore(prefs: SharedPreferences, id: String) {
    tripId = id
    startedAt = prefs.getLong(K_STARTED_AT, System.currentTimeMillis())
    mocked = prefs.getBoolean(K_MOCKED, false)
    accumulator.restore(
      prefs.getFloat(K_METERS, 0f).toDouble(),
      prefs.getInt(K_POINTS, 0),
      prefs.getInt(K_GAPS, 0),
      prefs.getFloat(K_LAT, 0f).toDouble(),
      prefs.getFloat(K_LNG, 0f).toDouble(),
      prefs.getLong(K_TIME, 0L),
    )
  }

  private fun requestLocationUpdates(): Boolean =
    try {
      val manager = getSystemService(Context.LOCATION_SERVICE) as LocationManager
      manager.requestLocationUpdates(
        LocationManager.GPS_PROVIDER,
        INTERVAL_MS,
        MIN_DISTANCE_M,
        this,
        Looper.getMainLooper(),
      )
      locationManager = manager
      true
    } catch (e: Exception) {
      false
    }

  private fun appendPoint(location: Location, accuracy: Float) {
    try {
      routeFile(this, tripId).appendText(
        String.format(Locale.US, "%d,%.6f,%.6f,%.0f\n", location.time, location.latitude, location.longitude, accuracy),
      )
    } catch (e: Exception) {
    }
  }

  private fun persist() {
    prefs(this).edit()
      .putFloat(K_METERS, accumulator.meters.toFloat())
      .putInt(K_POINTS, accumulator.points)
      .putInt(K_GAPS, accumulator.gaps)
      .putFloat(K_LAT, accumulator.lastLat.toFloat())
      .putFloat(K_LNG, accumulator.lastLng.toFloat())
      .putLong(K_TIME, accumulator.lastTimeMs)
      .putBoolean(K_MOCKED, mocked)
      .apply()
  }

  private fun refreshNotification() {
    try {
      getSystemService(NotificationManager::class.java).notify(NOTIFICATION_ID, buildNotification())
    } catch (e: Exception) {
    }
  }

  private fun createChannel() {
    if (Build.VERSION.SDK_INT < 26) return
    val channel = NotificationChannel(CHANNEL_ID, "Jornada em andamento", NotificationManager.IMPORTANCE_LOW)
    channel.description = "Mostra os km enquanto a jornada está aberta."
    channel.setShowBadge(false)
    getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
  }

  private fun buildNotification(): Notification {
    val km = String.format(Locale.forLanguageTag("pt-BR"), "%.1f km", accumulator.meters / 1000)
    @Suppress("DEPRECATION")
    val builder = if (Build.VERSION.SDK_INT >= 26) Notification.Builder(this, CHANNEL_ID) else Notification.Builder(this)
    builder.setSmallIcon(R.drawable.ic_stat_corre)
      .setColor(0xFF109150.toInt())
      .setContentTitle("Jornada em andamento · $km")
      .setContentText("Pode trocar de app. Só não feche o CORRE.")
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .setShowWhen(true)
      .setWhen(startedAt)
      .setUsesChronometer(true)
      .setCategory(Notification.CATEGORY_NAVIGATION)
    packageManager.getLaunchIntentForPackage(packageName)?.let { launch ->
      builder.setContentIntent(
        PendingIntent.getActivity(this, 0, launch, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT),
      )
    }
    if (Build.VERSION.SDK_INT >= 36) {
      builder.setRequestPromotedOngoing(true)
      builder.setShortCriticalText(km)
    }
    return builder.build()
  }

  companion object {
    const val EXTRA_TRIP_ID = "tripId"
    const val CHANNEL_ID = "jornada"
    const val NOTIFICATION_ID = 4201
    const val INTERVAL_MS = 5_000L
    const val MIN_DISTANCE_M = 10f
    const val NOTIFY_EVERY_KM = 0.5
    const val NOTIFY_EVERY_MS = 60_000L

    const val K_ID = "id"
    const val K_STARTED_AT = "iniciadaEm"
    const val K_METERS = "metros"
    const val K_POINTS = "pontos"
    const val K_GAPS = "buracos"
    const val K_LAT = "lat"
    const val K_LNG = "lng"
    const val K_TIME = "t"
    const val K_MOCKED = "simulado"

    private const val PREFS_NAME = "corre_jornada"

    @Volatile
    var running = false
      private set

    fun prefs(context: Context): SharedPreferences =
      context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    fun routeFile(context: Context, tripId: String) = File(context.filesDir, "jornada-$tripId.csv")
  }
}
