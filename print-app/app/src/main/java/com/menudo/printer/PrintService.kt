package com.menudo.printer

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
}