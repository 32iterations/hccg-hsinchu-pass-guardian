package com.hsinchupassguardian

import android.app.Application
import android.util.Log
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.ReactNativeHost
import com.facebook.react.ReactPackage
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import com.facebook.react.defaults.DefaultReactNativeHost
import com.google.android.gms.maps.MapsInitializer
import com.google.android.gms.maps.OnMapsSdkInitializedCallback

class MainApplication : Application(), ReactApplication, OnMapsSdkInitializedCallback {

  override val reactNativeHost: ReactNativeHost =
      object : DefaultReactNativeHost(this) {
        override fun getPackages(): List<ReactPackage> =
            PackageList(this).packages.apply {
              // Packages that cannot be autolinked yet can be added manually here, for example:
              // add(MyReactNativePackage())
            }

        override fun getJSMainModuleName(): String = "index"

        override fun getUseDeveloperSupport(): Boolean = BuildConfig.DEBUG

        override val isNewArchEnabled: Boolean = BuildConfig.IS_NEW_ARCHITECTURE_ENABLED
        override val isHermesEnabled: Boolean = BuildConfig.IS_HERMES_ENABLED
      }

  override val reactHost: ReactHost
    get() = getDefaultReactHost(applicationContext, reactNativeHost)

  override fun onCreate() {
    super.onCreate()
    Log.d("MainApplication", "Starting application initialization")

    // Initialize Google Maps SDK
    try {
      Log.d("MainApplication", "Initializing Google Maps SDK...")
      MapsInitializer.initialize(applicationContext, MapsInitializer.Renderer.LATEST, this)
    } catch (e: Exception) {
      Log.e("MainApplication", "Error initializing Google Maps: ${e.message}", e)
    }

    loadReactNative(this)
    Log.d("MainApplication", "Application initialization complete")
  }

  override fun onMapsSdkInitialized(renderer: MapsInitializer.Renderer) {
    when (renderer) {
      MapsInitializer.Renderer.LATEST -> Log.d("MainApplication", "Google Maps SDK initialized with latest renderer")
      MapsInitializer.Renderer.LEGACY -> Log.d("MainApplication", "Google Maps SDK initialized with legacy renderer")
      else -> Log.d("MainApplication", "Google Maps SDK initialized with unknown renderer")
    }
  }
}
