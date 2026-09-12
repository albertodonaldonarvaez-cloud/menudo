package com.menudo.printer

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
            binding.tvStatus.text = status
        }

        PrintService.onLogAdded = { log ->
            addLog(log)
        }

        binding.tvStatus.text = PrintService.status

        // Pedir exclusión de optimización de batería (Huawei mata servicios)
        requestBatteryExclusion()

        // Auto-iniciar servicio si ya tiene impresora guardada
        if (!PrintService.isRunning && prefs.lastDeviceAddress != null) {
            autoStartService()
        }
    }

    @SuppressLint("BatteryLife")
    private fun requestBatteryExclusion() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            val pm = getSystemService(Context.POWER_SERVICE) as android.os.PowerManager
            if (!pm.isIgnoringBatteryOptimizations(packageName)) {
                try {
                    val intent = Intent(android.provider.Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS)
                    intent.data = android.net.Uri.parse("package:$packageName")
                    startActivity(intent)
                } catch (_: Exception) { }
            }
        }
    }

    private fun autoStartService() {
        // Guardar URL actual
        prefs.serverUrl = binding.etServerUrl.text.toString()

        val intent = Intent(this, PrintService::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(intent)
        } else {
            startService(intent)
        }
        addLog("Servicio auto-iniciado")
        updateUI()
    }

    private fun setupUI() {
        // Guardar configuracion
        binding.btnConnect.setOnClickListener {
            prefs.serverUrl = binding.etServerUrl.text.toString()
            val selectedItem = binding.spinnerDevices.selectedItem as? String
            if (selectedItem != null) {
                val address = selectedItem.substringAfterLast("(").substringBeforeLast(")")
                prefs.lastDeviceAddress = address
                val name = selectedItem.substringBeforeLast("(").trim()
                Toast.makeText(this, "Impresora: $name", Toast.LENGTH_SHORT).show()

                // Si el servicio ya corre, reiniciarlo con la nueva impresora
                if (PrintService.isRunning) {
                    stopService(Intent(this, PrintService::class.java))
                }
                autoStartService()
            }
        }

        // Toggle servicio
        binding.btnToggleService.setOnClickListener {
            if (PrintService.isRunning) {
                stopService(Intent(this, PrintService::class.java))
                addLog("Servicio detenido")
            } else {
                prefs.serverUrl = binding.etServerUrl.text.toString()
                autoStartService()
            }
            updateUI()
        }

        // Test print
        binding.btnTestPrint.setOnClickListener {
            val deviceAddress = prefs.lastDeviceAddress
            if (deviceAddress == null) {
                Toast.makeText(this, "Selecciona una impresora primero", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }
            binding.btnTestPrint.isEnabled = false
            binding.btnTestPrint.text = "Imprimiendo..."
            addLog("Enviando prueba...")

            CoroutineScope(Dispatchers.IO).launch {
                val printer = BluetoothPrinter(btAdapter)
                val success = if (printer.connect(deviceAddress)) {
                    val result = printer.sendRaw(TsplFormatter.formatTest())
                    Thread.sleep(2000)
                    printer.disconnect()
                    result
                } else false

                runOnUiThread {
                    binding.btnTestPrint.isEnabled = true
                    binding.btnTestPrint.text = "Test Print"
                    if (success) {
                        addLog("Prueba impresa OK")
                        Toast.makeText(this@MainActivity, "Impreso!", Toast.LENGTH_SHORT).show()
                    } else {
                        addLog("Error: no se pudo imprimir")
                        Toast.makeText(this@MainActivity, "Error de conexion", Toast.LENGTH_SHORT).show()
                    }
                }
            }
        }
    }

    private fun addLog(msg: String) {
        val time = java.text.SimpleDateFormat("h:mm:ss a", java.util.Locale.US).format(java.util.Date())
        logs.add(0, "[$time] $msg")
        if (logs.size > 30) logs.removeLast()
        binding.tvLogs.text = logs.joinToString("\n")
    }

    private fun updateUI() {
        binding.btnToggleService.text = if (PrintService.isRunning) "Detener Servicio" else "Iniciar Servicio"
        loadPairedDevices()
    }

    @SuppressLint("MissingPermission")
    private fun loadPairedDevices() {
        if (!hasBtPermissions()) return

        val pairedDevices: Set<BluetoothDevice>? = btAdapter?.bondedDevices
        val list = mutableListOf<String>()
        var selectedIndex = 0

        pairedDevices?.forEachIndexed { index, device ->
            val name = device.name ?: "Desconocido"
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
            // Auto-iniciar si ya hay impresora guardada
            if (prefs.lastDeviceAddress != null && !PrintService.isRunning) {
                autoStartService()
            }
        }
    }

    override fun onResume() {
        super.onResume()
        updateUI()
        binding.tvStatus.text = PrintService.status
    }
}