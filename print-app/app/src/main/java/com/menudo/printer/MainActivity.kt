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
}