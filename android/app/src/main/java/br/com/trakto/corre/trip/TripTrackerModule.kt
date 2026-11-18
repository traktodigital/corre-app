package br.com.trakto.corre.trip

import android.Manifest
import android.annotation.SuppressLint
import android.app.ForegroundServiceStartNotAllowedException
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.location.LocationManager
import android.os.Build
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableMap

class TripTrackerModule(private val context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {

  override fun getName() = NAME

  @ReactMethod
  fun start(tripId: String, promise: Promise) {
    if (!hasLocationPermission()) {
      promise.reject(ERROR_PERMISSION, "Permissão de localização não concedida.")
      return
    }
    var freshTrip = false
    try {
      val prefs = TripTrackerService.prefs(context)
      freshTrip = prefs.getString(TripTrackerService.K_ID, null) != tripId
      if (freshTrip) {
        prefs.edit().clear()
          .putString(TripTrackerService.K_ID, tripId)
          .putLong(TripTrackerService.K_STARTED_AT, System.currentTimeMillis())
          .apply()
      }
      val intent = Intent(context, TripTrackerService::class.java)
        .putExtra(TripTrackerService.EXTRA_TRIP_ID, tripId)
      if (Build.VERSION.SDK_INT >= 26) context.startForegroundService(intent) else context.startService(intent)
      promise.resolve(null)
    } catch (e: SecurityException) {
      rollback(freshTrip)
      promise.reject(ERROR_SECURITY, e.message, e)
    } catch (e: IllegalStateException) {
      rollback(freshTrip)
      val code = if (Build.VERSION.SDK_INT >= 31 && e is ForegroundServiceStartNotAllowedException) {
        ERROR_NOT_ALLOWED
      } else {
        ERROR_START
      }
      promise.reject(code, e.message, e)
    } catch (e: Exception) {
      rollback(freshTrip)
      promise.reject(ERROR_START, e.message, e)
    }
  }

  @ReactMethod
  fun getState(promise: Promise) {
    promise.resolve(readState())
  }

  @SuppressLint("MissingPermission")
  @ReactMethod
  fun getLastLocation(promise: Promise) {
    if (!hasLocationPermission()) {
      promise.resolve(null)
      return
    }
    try {
      val manager = context.getSystemService(Context.LOCATION_SERVICE) as LocationManager
      val best = manager.getProviders(true)
        .mapNotNull { provider -> manager.getLastKnownLocation(provider) }
        .maxByOrNull { location -> location.time }
      promise.resolve(
        best?.let { location ->
          Arguments.createMap().apply {
            putDouble("lat", location.latitude)
            putDouble("lng", location.longitude)
            putDouble("accuracy", if (location.hasAccuracy()) location.accuracy.toDouble() else -1.0)
            putDouble("time", location.time.toDouble())
          }
        },
      )
    } catch (e: Exception) {
      promise.resolve(null)
    }
  }

  @ReactMethod
  fun stop(promise: Promise) {
    val state = readState()
    try {
      context.stopService(Intent(context, TripTrackerService::class.java))
    } catch (e: Exception) {
    }
    clearPrefs()
    promise.resolve(state)
  }

  private fun hasLocationPermission(): Boolean =
    try {
      context.checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
    } catch (e: Exception) {
      false
    }

  private fun rollback(freshTrip: Boolean) {
    if (freshTrip) clearPrefs()
  }

  private fun clearPrefs() {
    try {
      TripTrackerService.prefs(context).edit().clear().apply()
    } catch (e: Exception) {
    }
  }

  private fun readState(): WritableMap? =
    try {
      val prefs = TripTrackerService.prefs(context)
      val id = prefs.getString(TripTrackerService.K_ID, null)
      if (id == null) {
        null
      } else {
        Arguments.createMap().apply {
          putBoolean("active", TripTrackerService.running)
          putString("tripId", id)
          putDouble("km", prefs.getFloat(TripTrackerService.K_METERS, 0f) / 1000.0)
          putInt("points", prefs.getInt(TripTrackerService.K_POINTS, 0))
          putInt("gaps", prefs.getInt(TripTrackerService.K_GAPS, 0))
          putBoolean("mocked", prefs.getBoolean(TripTrackerService.K_MOCKED, false))
          putDouble("startedAt", prefs.getLong(TripTrackerService.K_STARTED_AT, 0L).toDouble())
          putString("file", TripTrackerService.routeFile(context, id).absolutePath)
        }
      }
    } catch (e: Exception) {
      null
    }

  companion object {
    const val NAME = "TripTracker"
    const val ERROR_PERMISSION = "permission_denied"
    const val ERROR_NOT_ALLOWED = "foreground_not_allowed"
    const val ERROR_SECURITY = "security_error"
    const val ERROR_START = "start_failed"
  }
}
