package expo.modules.playservices

import com.google.android.gms.common.ConnectionResult
import com.google.android.gms.common.GoogleApiAvailability
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

// Tells JS whether Google Play services can run here. Google Maps needs it;
// de-Googled phones (GrapheneOS without sandboxed Play, Huawei, emulators
// without Google APIs) don't have it.
class PlayServicesModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("PlayServices")

    Function("isAvailable") {
      val context = appContext.reactContext ?: return@Function false
      try {
        GoogleApiAvailability.getInstance()
          .isGooglePlayServicesAvailable(context) == ConnectionResult.SUCCESS
      } catch (e: Throwable) {
        false
      }
    }
  }
}
