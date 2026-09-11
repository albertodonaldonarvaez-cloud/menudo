import os

base_dir = r"c:\Users\donal\Downloads\menudo\print-app"

files = {
    "settings.gradle.kts": """pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}
rootProject.name = "MenudoPrinter"
include(":app")
""",
    "build.gradle.kts": """plugins {
    id("com.android.application") version "8.2.2" apply false
    id("org.jetbrains.kotlin.android") version "1.9.22" apply false
}
""",
    "gradle.properties": """org.gradle.jvmargs=-Xmx2048m -Dfile.encoding=UTF-8
android.useAndroidX=true
kotlin.code.style=official
android.nonTransitiveRClass=true
""",
    r"gradle\wrapper\gradle-wrapper.properties": """distributionBase=GRADLE_USER_HOME
distributionPath=wrapper/dists
distributionUrl=https\://services.gradle.org/distributions/gradle-8.2-bin.zip
zipStoreBase=GRADLE_USER_HOME
zipStorePath=wrapper/dists
""",
    r"app\build.gradle.kts": """plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.menudo.printer"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.menudo.printer"
        minSdk = 26
        targetSdk = 34
        versionCode = 1
        versionName = "1.0"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_1_8
        targetCompatibility = JavaVersion.VERSION_1_8
    }
    kotlinOptions {
        jvmTarget = "1.8"
    }
    buildFeatures {
        viewBinding = true
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.12.0")
    implementation("androidx.appcompat:appcompat:1.6.1")
    implementation("com.google.android.material:material:1.11.0")
    implementation("androidx.constraintlayout:constraintlayout:2.1.4")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.7.3")
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
}
""",
    r"app\src\main\AndroidManifest.xml": """<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:tools="http://schemas.android.com/tools">

    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.BLUETOOTH" android:maxSdkVersion="30" />
    <uses-permission android:name="android.permission.BLUETOOTH_ADMIN" android:maxSdkVersion="30" />
    <uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />
    <uses-permission android:name="android.permission.BLUETOOTH_SCAN" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_CONNECTED_DEVICE" />
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />

    <application
        android:allowBackup="true"
        android:icon="@drawable/ic_printer"
        android:label="@string/app_name"
        android:roundIcon="@drawable/ic_printer"
        android:supportsRtl="true"
        android:theme="@style/Theme.MenudoPrinter"
        android:usesCleartextTraffic="true"
        tools:targetApi="31">
        <activity
            android:name=".MainActivity"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
        
        <service
            android:name=".PrintService"
            android:foregroundServiceType="connectedDevice"
            android:exported="false" />
    </application>

</manifest>""",
    r"app\src\main\res\values\strings.xml": """<resources>
    <string name="app_name">Menudo Printer</string>
</resources>""",
    r"app\src\main\res\values\colors.xml": """<resources>
    <color name="black">#FF000000</color>
    <color name="white">#FFFFFFFF</color>
    <color name="primary">#FF6200EE</color>
    <color name="primary_dark">#FF3700B3</color>
    <color name="accent">#FF03DAC5</color>
</resources>""",
    r"app\src\main\res\values\themes.xml": """<resources xmlns:tools="http://schemas.android.com/tools">
    <style name="Theme.MenudoPrinter" parent="Theme.Material3.DayNight.NoActionBar">
        <item name="colorPrimary">@color/primary</item>
        <item name="colorPrimaryVariant">@color/primary_dark</item>
        <item name="colorOnPrimary">@color/white</item>
    </style>
</resources>""",
    r"app\src\main\res\drawable\ic_printer.xml": """<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="24dp"
    android:height="24dp"
    android:viewportWidth="24"
    android:viewportHeight="24"
    android:tint="#000000">
    <path
        android:fillColor="@android:color/white"
        android:pathData="M19,8H5c-1.66,0-3,1.34-3,3v6h4v4h12v-4h4v-6c0-1.66-1.34-3-3-3zM16,19H8v-5h8v5zM19,12c-0.55,0-1-0.45-1-1s0.45-1,1-1s1,0.45,1,1s-0.45,1-1,1zM18,3H6v4h12V3z"/>
</vector>""",
    r"app\src\main\res\layout\activity_main.xml": """<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:orientation="vertical"
    android:padding="16dp">

    <TextView
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:text="Server URL:"
        android:textStyle="bold" />

    <EditText
        android:id="@+id/etServerUrl"
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:inputType="textUri"
        android:text="https://menudo.tecti-cloud.com" />

    <TextView
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:layout_marginTop="16dp"
        android:text="Select Printer:"
        android:textStyle="bold" />

    <Spinner
        android:id="@+id/spinnerDevices"
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:minHeight="48dp" />

    <Button
        android:id="@+id/btnConnect"
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:text="Connect" />

    <Button
        android:id="@+id/btnToggleService"
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:layout_marginTop="16dp"
        android:text="Start Service" />

    <TextView
        android:id="@+id/tvStatus"
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:layout_marginTop="16dp"
        android:text="Status: Disconnected"
        android:textAlignment="center"
        android:textSize="18sp"
        android:textStyle="bold" />

    <Button
        android:id="@+id/btnTestPrint"
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:layout_marginTop="16dp"
        android:text="Test Print" />

    <TextView
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:layout_marginTop="16dp"
        android:text="Recent Prints:"
        android:textStyle="bold" />

    <ScrollView
        android:layout_width="match_parent"
        android:layout_height="0dp"
        android:layout_weight="1"
        android:layout_marginTop="8dp">

        <TextView
            android:id="@+id/tvLogs"
            android:layout_width="match_parent"
            android:layout_height="wrap_content"
            android:fontFamily="monospace"
            android:textSize="12sp" />
    </ScrollView>
</LinearLayout>""",
    r"app\src\main\java\com\menudo\printer\PrefsManager.kt": """package com.menudo.printer

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
}""",
    r"app\src\main\java\com\menudo\printer\EscPosFormatter.kt": """package com.menudo.printer

import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

object EscPosFormatter {
    private const val LINE_CHARS = 32

    fun formatOrder(order: OrderPoller.Order): ByteArray {
        val builder = StringBuilder()
        
        builder.append("================================\n")
        builder.append("    MENUDERÍA Y BARBACOA\n")
        builder.append("================================\n")
        
        builder.append("  COMANDA #${order.num}\n")
        builder.append("  Cliente: ${order.clientName}\n")
        builder.append("  Tipo: ${order.orderType.uppercase()}\n")
        
        val timeFormat = SimpleDateFormat("h:mm a", Locale.US)
        var timeStr = "Desconocida"
        try {
            val date = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).parse(order.timestamp)
            if (date != null) timeStr = timeFormat.format(date)
        } catch (e: Exception) {}
        
        builder.append("  Hora: $timeStr\n")
        builder.append("--------------------------------\n")
        
        for (item in order.items) {
            val qtyStr = "${item.qty}x "
            val titleStr = item.title
            val line = "  $qtyStr$titleStr"
            builder.append(line)
            if (line.length > LINE_CHARS) {
                builder.append("\n")
            } else {
                builder.append("\n")
            }
        }
        
        builder.append("--------------------------------\n")
        builder.append("  TOTAL: $${order.total}\n")
        builder.append("================================\n\n\n\n\n")

        val textBytes = builder.toString().toByteArray(Charsets.ISO_8859_1) // Use ISO for ESC/POS generally
        
        // Init printer + Text + Cut/Feed
        val init = byteArrayOf(0x1B, 0x40) // ESC @
        
        val result = ByteArray(init.size + textBytes.size)
        System.arraycopy(init, 0, result, 0, init.size)
        System.arraycopy(textBytes, 0, result, init.size, textBytes.size)
        
        return result
    }
    
    fun formatTest(): ByteArray {
        val text = "================================\n" +
                   "      PRUEBA DE IMPRESION\n" +
                   "================================\n\n\n\n\n"
        val init = byteArrayOf(0x1B, 0x40) // ESC @
        val textBytes = text.toByteArray(Charsets.ISO_8859_1)
        val result = ByteArray(init.size + textBytes.size)
        System.arraycopy(init, 0, result, 0, init.size)
        System.arraycopy(textBytes, 0, result, init.size, textBytes.size)
        return result
    }
}""",
    r"app\src\main\java\com\menudo\printer\BluetoothPrinter.kt": """package com.menudo.printer

import android.annotation.SuppressLint
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothSocket
import android.util.Log
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.IOException
import java.io.OutputStream
import java.util.UUID

class BluetoothPrinter(private val adapter: BluetoothAdapter?) {
    private var socket: BluetoothSocket? = null
    private var outStream: OutputStream? = null
    private val SPP_UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB")

    var isConnected = false
        private set

    @SuppressLint("MissingPermission")
    suspend fun connect(deviceAddress: String): Boolean = withContext(Dispatchers.IO) {
        if (adapter == null) return@withContext false
        try {
            val device = adapter.getRemoteDevice(deviceAddress)
            socket = device.createRfcommSocketToServiceRecord(SPP_UUID)
            adapter.cancelDiscovery()
            socket?.connect()
            outStream = socket?.outputStream
            isConnected = true
            return@withContext true
        } catch (e: Exception) {
            Log.e("BluetoothPrinter", "Error connecting", e)
            disconnect()
            return@withContext false
        }
    }

    fun disconnect() {
        try {
            outStream?.close()
            socket?.close()
        } catch (e: Exception) {}
        socket = null
        outStream = null
        isConnected = false
    }

    suspend fun print(data: ByteArray): Boolean = withContext(Dispatchers.IO) {
        if (!isConnected || outStream == null) return@withContext false
        try {
            outStream?.write(data)
            outStream?.flush()
            return@withContext true
        } catch (e: IOException) {
            Log.e("BluetoothPrinter", "Error printing", e)
            disconnect()
            return@withContext false
        }
    }
}""",
    r"app\src\main\java\com\menudo\printer\OrderPoller.kt": """package com.menudo.printer

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONObject
import java.util.concurrent.TimeUnit

class OrderPoller(private val prefs: PrefsManager) {
    private val client = OkHttpClient.Builder()
        .connectTimeout(5, TimeUnit.SECONDS)
        .readTimeout(5, TimeUnit.SECONDS)
        .build()

    data class Order(
        val id: String,
        val num: Int,
        val clientName: String,
        val orderType: String,
        val total: Int,
        val timestamp: String,
        val items: List<OrderItem>
    )

    data class OrderItem(
        val title: String,
        val qty: Int
    )

    suspend fun fetchOrders(isFirstRun: Boolean): List<Order> = withContext(Dispatchers.IO) {
        val url = prefs.serverUrl.trimEnd('/') + "/api/orders"
        val request = Request.Builder().url(url).build()

        try {
            val response = client.newCall(request).execute()
            if (!response.isSuccessful) return@withContext emptyList()

            val body = response.body?.string() ?: return@withContext emptyList()
            val json = JSONObject(body)
            val pendingArray = json.optJSONArray("pendingPayment") ?: return@withContext emptyList()

            val orders = mutableListOf<Order>()
            for (i in 0 until pendingArray.length()) {
                val obj = pendingArray.getJSONObject(i)
                val id = obj.getString("id")
                val num = obj.getInt("num")
                val clientName = obj.optString("clientName", "Desconocido")
                val orderType = obj.optString("orderType", "aqui")
                val total = obj.optInt("total", 0)
                val timestamp = obj.optString("timestamp", "")
                
                val itemsArray = obj.optJSONArray("items")
                val itemsList = mutableListOf<OrderItem>()
                if (itemsArray != null) {
                    for (j in 0 until itemsArray.length()) {
                        val itemObj = itemsArray.getJSONObject(j)
                        itemsList.add(OrderItem(
                            title = itemObj.optString("title", "Item"),
                            qty = itemObj.optInt("qty", 1)
                        ))
                    }
                }

                orders.add(Order(id, num, clientName, orderType, total, timestamp, itemsList))
            }
            return@withContext orders
        } catch (e: Exception) {
            e.printStackTrace()
            return@withContext emptyList()
        }
    }
}""",
    r"app\src\main\java\com\menudo\printer\PrintService.kt": """package com.menudo.printer

import android.annotation.SuppressLint
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.bluetooth.BluetoothManager
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder
import android.util.Log
import androidx.core.app.NotificationCompat
import kotlinx.coroutines.*

class PrintService : Service() {
    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private lateinit var printer: BluetoothPrinter
    private lateinit var poller: OrderPoller
    private lateinit var prefs: PrefsManager
    private val printedOrders = mutableSetOf<String>()
    
    private val CHANNEL_ID = "PrinterServiceChannel"

    companion object {
        var isRunning = false
        var status = "Stopped"
        var onStatusChanged: ((String) -> Unit)? = null
        var onLogAdded: ((String) -> Unit)? = null
    }

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
        prefs = PrefsManager(this)
        val btManager = getSystemService(Context.BLUETOOTH_SERVICE) as BluetoothManager
        printer = BluetoothPrinter(btManager.adapter)
        poller = OrderPoller(prefs)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val notification = createNotification("Starting printer service...")
        startForeground(1, notification)
        isRunning = true
        
        scope.launch {
            pollAndPrint()
        }
        
        return START_STICKY
    }

    private suspend fun pollAndPrint() {
        var isFirstRun = true
        
        while (isRunning) {
            val deviceAddress = prefs.lastDeviceAddress
            if (deviceAddress != null && !printer.isConnected) {
                updateStatus("Connecting to printer...")
                val connected = printer.connect(deviceAddress)
                if (connected) {
                    updateStatus("Connected")
                } else {
                    updateStatus("Printer connection failed")
                }
            }

            if (printer.isConnected) {
                try {
                    val orders = poller.fetchOrders(isFirstRun)
                    
                    if (isFirstRun) {
                        orders.forEach { printedOrders.add(it.id) }
                        isFirstRun = false
                        log("Service started. Ignored ${orders.size} existing orders.")
                    } else {
                        for (order in orders) {
                            if (!printedOrders.contains(order.id)) {
                                updateStatus("Printing Order #${order.num}")
                                val data = EscPosFormatter.formatOrder(order)
                                val success = printer.print(data)
                                if (success) {
                                    printedOrders.add(order.id)
                                    log("Printed Order #${order.num}")
                                } else {
                                    log("Failed to print Order #${order.num}")
                                }
                                delay(2000) // Delay between prints
                            }
                        }
                        updateStatus("Connected, polling...")
                    }
                } catch (e: Exception) {
                    Log.e("PrintService", "Polling error", e)
                }
            }
            
            delay(8000) // Poll every 8 seconds
        }
    }

    private fun updateStatus(newStatus: String) {
        status = newStatus
        val manager = getSystemService(NotificationManager::class.java)
        manager?.notify(1, createNotification(newStatus))
        
        CoroutineScope(Dispatchers.Main).launch {
            onStatusChanged?.invoke(newStatus)
        }
    }

    private fun log(message: String) {
        CoroutineScope(Dispatchers.Main).launch {
            onLogAdded?.invoke(message)
        }
    }

    @SuppressLint("UnspecifiedImmutableFlag")
    private fun createNotification(text: String): Notification {
        val intent = Intent(this, MainActivity::class.java)
        val pendingIntent = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            PendingIntent.getActivity(this, 0, intent, PendingIntent.FLAG_IMMUTABLE)
        } else {
            PendingIntent.getActivity(this, 0, intent, 0)
        }

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Menudo Printer Service")
            .setContentText(text)
            .setSmallIcon(R.drawable.ic_printer)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .build()
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Printer Service",
                NotificationManager.IMPORTANCE_LOW
            )
            val manager = getSystemService(NotificationManager::class.java)
            manager?.createNotificationChannel(channel)
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        isRunning = false
        scope.cancel()
        printer.disconnect()
        status = "Stopped"
        onStatusChanged?.invoke("Stopped")
    }

    override fun onBind(intent: Intent?): IBinder? = null
}""",
    r"app\src\main\java\com\menudo\printer\MainActivity.kt": """package com.menudo.printer

import android.Manifest
import android.annotation.SuppressLint
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.widget.ArrayAdapter
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import com.menudo.printer.databinding.ActivityMainBinding
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class MainActivity : AppCompatActivity() {
    private lateinit var binding: ActivityMainBinding
    private lateinit var prefs: PrefsManager
    private var btAdapter: BluetoothAdapter? = null
    private val PERMISSION_REQUEST = 101

    private val logs = mutableListOf<String>()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        prefs = PrefsManager(this)
        binding.etServerUrl.setText(prefs.serverUrl)

        val btManager = getSystemService(Context.BLUETOOTH_SERVICE) as BluetoothManager
        btAdapter = btManager.adapter

        requestPermissions()

        setupUI()
        updateUI()

        PrintService.onStatusChanged = { status ->
            binding.tvStatus.text = "Status: $status"
        }
        
        PrintService.onLogAdded = { log ->
            addLog(log)
        }
        
        binding.tvStatus.text = "Status: ${PrintService.status}"
    }

    private fun setupUI() {
        binding.btnConnect.setOnClickListener {
            prefs.serverUrl = binding.etServerUrl.text.toString()
            val selectedItem = binding.spinnerDevices.selectedItem as? String
            if (selectedItem != null) {
                val address = selectedItem.substringAfterLast("(").substringBeforeLast(")")
                prefs.lastDeviceAddress = address
                Toast.makeText(this, "Saved $address. Restart service to connect.", Toast.LENGTH_SHORT).show()
            }
        }

        binding.btnToggleService.setOnClickListener {
            if (PrintService.isRunning) {
                stopService(Intent(this, PrintService::class.java))
                binding.btnToggleService.text = "Start Service"
            } else {
                val intent = Intent(this, PrintService::class.java)
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    startForegroundService(intent)
                } else {
                    startService(intent)
                }
                binding.btnToggleService.text = "Stop Service"
            }
        }

        binding.btnTestPrint.setOnClickListener {
            val deviceAddress = prefs.lastDeviceAddress
            if (deviceAddress != null) {
                CoroutineScope(Dispatchers.IO).launch {
                    val printer = BluetoothPrinter(btAdapter)
                    if (printer.connect(deviceAddress)) {
                        printer.print(EscPosFormatter.formatTest())
                        printer.disconnect()
                        runOnUiThread { addLog("Test print sent.") }
                    } else {
                        runOnUiThread { addLog("Test print failed.") }
                    }
                }
            }
        }
    }

    private fun addLog(msg: String) {
        logs.add(0, msg)
        if (logs.size > 20) logs.removeLast()
        binding.tvLogs.text = logs.joinToString("\n")
    }

    private fun updateUI() {
        binding.btnToggleService.text = if (PrintService.isRunning) "Stop Service" else "Start Service"
        loadPairedDevices()
    }

    @SuppressLint("MissingPermission")
    private fun loadPairedDevices() {
        if (!hasBtPermissions()) return
        
        val pairedDevices: Set<BluetoothDevice>? = btAdapter?.bondedDevices
        val list = mutableListOf<String>()
        var selectedIndex = 0
        
        pairedDevices?.forEachIndexed { index, device ->
            val name = device.name ?: "Unknown"
            list.add("$name (${device.address})")
            if (device.address == prefs.lastDeviceAddress) {
                selectedIndex = index
            }
        }
        
        val adapter = ArrayAdapter(this, android.R.layout.simple_spinner_item, list)
        adapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item)
        binding.spinnerDevices.adapter = adapter
        if (list.isNotEmpty()) {
            binding.spinnerDevices.setSelection(selectedIndex)
        }
    }

    private fun hasBtPermissions(): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            ContextCompat.checkSelfPermission(this, Manifest.permission.BLUETOOTH_CONNECT) == PackageManager.PERMISSION_GRANTED
        } else {
            ContextCompat.checkSelfPermission(this, Manifest.permission.BLUETOOTH) == PackageManager.PERMISSION_GRANTED
        }
    }

    private fun requestPermissions() {
        val perms = mutableListOf(
            Manifest.permission.INTERNET,
            Manifest.permission.FOREGROUND_SERVICE
        )
        
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            perms.add(Manifest.permission.BLUETOOTH_CONNECT)
            perms.add(Manifest.permission.BLUETOOTH_SCAN)
        } else {
            perms.add(Manifest.permission.BLUETOOTH)
            perms.add(Manifest.permission.BLUETOOTH_ADMIN)
        }
        
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            perms.add(Manifest.permission.POST_NOTIFICATIONS)
        }
        
        val missing = perms.filter { ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED }
        if (missing.isNotEmpty()) {
            ActivityCompat.requestPermissions(this, missing.toTypedArray(), PERMISSION_REQUEST)
        }
    }
    
    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == PERMISSION_REQUEST) {
            loadPairedDevices()
        }
    }
}""",
    "README.md": """# Menudo Print App
    
Bluetooth thermal print app for Menudo orders.
- Connects to SUM Print 365B
- SPP Bluetooth Profile
- ESC/POS
- Foreground Service for continuous polling
"""
}

for rel_path, content in files.items():
    full_path = os.path.join(base_dir, rel_path)
    os.makedirs(os.path.dirname(full_path), exist_ok=True)
    with open(full_path, "w", encoding="utf-8") as f:
        f.write(content)

print("Files created successfully.")
