package com.menudo.printer

import android.content.Context
import android.content.SharedPreferences

class PrefsManager(context: Context) {
    private val prefs: SharedPreferences = context.getSharedPreferences("PrinterPrefs", Context.MODE_PRIVATE)

    var serverUrl: String
        get() = prefs.getString("server_url", "https://menudo.tecti-cloud.com") ?: "https://menudo.tecti-cloud.com"
        set(value) = prefs.edit().putString("server_url", value).apply()

    var lastDeviceAddress: String?
        get() = prefs.getString("last_device_address", null)
        set(value) = prefs.edit().putString("last_device_address", value).apply()
}