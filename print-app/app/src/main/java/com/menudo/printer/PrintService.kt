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
    private val printedTickets = mutableSetOf<String>()
    private var printCount = 0

    private val CHANNEL_ID = "PrinterServiceChannel"

    companion object {
        var isRunning = false
        var status = "Detenido"
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
        val notification = createNotification("Iniciando servicio...")
        startForeground(1, notification)
        isRunning = true

        scope.launch { pollAndPrint() }

        return START_STICKY
    }

    private suspend fun pollAndPrint() {
        var isFirstRun = true

        while (isRunning) {
            val deviceAddress = prefs.lastDeviceAddress
            if (deviceAddress != null && !printer.isConnected) {
                updateStatus("Conectando impresora...")
                val connected = printer.connect(deviceAddress)
                if (connected) {
                    updateStatus("Conectada")
                } else {
                    updateStatus("Error de conexion")
                }
            }

            if (printer.isConnected) {
                // 1. Imprimir comandas nuevas
                try {
                    val orders = poller.fetchOrders(isFirstRun)

                    if (isFirstRun) {
                        orders.forEach { printedOrders.add(it.id) }
                        isFirstRun = false
                        log("Servicio iniciado. ${orders.size} ordenes existentes ignoradas.")
                    } else {
                        for (order in orders) {
                            if (!printedOrders.contains(order.id)) {
                                val copies = order.printCopies
                                val tspl = TsplFormatter.formatComanda(order, copies)
                                // Imprimir copia por copia con 5s de espera para cortar
                                for (copy in 1..copies) {
                                    updateStatus("Imprimiendo #${order.num} ($copy/$copies)...")
                                    val success = printer.sendRaw(tspl)
                                    if (!success) {
                                        log("Error imprimiendo #${order.num}")
                                        break
                                    }
                                    if (copy < copies) {
                                        delay(5000) // 5 segundos para cortar
                                    }
                                }
                                printedOrders.add(order.id)
                                printCount++
                                log("Comanda #${order.num} impresa (${copies}x)")
                                delay(3000)
                            }
                        }
                    }
                } catch (e: Exception) {
                    Log.e("PrintService", "Polling error", e)
                }

                // 2. Imprimir tickets de cobro
                try {
                    val tickets = poller.fetchPrintQueue()
                    val ackIds = mutableListOf<String>()

                    for (ticket in tickets) {
                        val tid = ticket.orderId
                        if (tid != null && !printedTickets.contains(tid)) {
                            updateStatus("Imprimiendo ticket...")
                            val tspl = TsplFormatter.formatTicketFromJson(ticket)
                            val success = printer.sendRaw(tspl)
                            if (success) {
                                printedTickets.add(tid)
                                ackIds.add(tid)
                                log("Ticket cobro impreso: ${ticket.clientName}")
                                delay(3000)
                            }
                        }
                    }

                    if (ackIds.isNotEmpty()) {
                        poller.ackPrintQueue(ackIds)
                    }
                } catch (e: Exception) {
                    Log.e("PrintService", "Ticket queue error", e)
                }

                // 3. Imprimir comandas adicionales (excedente)
                try {
                    val comandas = poller.fetchComandaQueue()
                    val ackIds2 = mutableListOf<String>()

                    for (comanda in comandas) {
                        val cid = comanda.createdAt
                        if (cid.isNotEmpty()) {
                            val copies = comanda.printCopies
                            val tspl = TsplFormatter.formatComandaAddition(comanda)
                            for (copy in 1..copies) {
                                updateStatus("Adicional #${comanda.num} ($copy/$copies)...")
                                val success = printer.sendRaw(tspl)
                                if (!success) break
                                if (copy < copies) delay(5000)
                            }
                            ackIds2.add(cid)
                            log("Adicional #${comanda.num}: +${comanda.items.size} items (${copies}x)")
                            delay(3000)
                        }
                    }

                    if (ackIds2.isNotEmpty()) {
                        poller.ackComandaQueue(ackIds2)
                    }
                } catch (e: Exception) {
                    Log.e("PrintService", "Comanda queue error", e)
                }

                updateStatus("Conectada, esperando...")
            }

            delay(8000)
        }
    }

    private fun updateStatus(newStatus: String) {
        status = newStatus
        val notifText = if (printCount > 0) "$newStatus | $printCount impresas" else newStatus
        val manager = getSystemService(NotificationManager::class.java)
        manager?.notify(1, createNotification(notifText))

        CoroutineScope(Dispatchers.Main).launch {
            onStatusChanged?.invoke(notifText)
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
        intent.flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
        val pendingIntent = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            PendingIntent.getActivity(this, 0, intent, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
        } else {
            PendingIntent.getActivity(this, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT)
        }

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Menudo Printer")
            .setContentText(text)
            .setSmallIcon(R.drawable.ic_printer)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .setSilent(true)
            .build()
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Impresora Menudo",
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
        status = "Detenido"
        onStatusChanged?.invoke("Detenido")
    }

    override fun onBind(intent: Intent?): IBinder? = null
}