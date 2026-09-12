package com.menudo.printer

import android.annotation.SuppressLint
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothSocket
import android.util.Log
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.OutputStream
import java.util.UUID

private const val TAG = "MenudoPrinter"
private val SPP_UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB")

@SuppressLint("MissingPermission")
class BluetoothPrinter(private val adapter: BluetoothAdapter?) {
    private var socket: BluetoothSocket? = null
    private var outStream: OutputStream? = null

    var isConnected = false
        private set

    suspend fun connect(deviceAddress: String): Boolean = withContext(Dispatchers.IO) {
        disconnect()
        if (adapter == null) return@withContext false
        val device = try { adapter.getRemoteDevice(deviceAddress) } catch (e: Exception) { return@withContext false }
        adapter.cancelDiscovery()

        // Attempt 1: insecure socket (most compatible with Chinese printers)
        var sock: BluetoothSocket? = null
        try {
            sock = device.createInsecureRfcommSocketToServiceRecord(SPP_UUID)
            sock.connect()
            Log.d(TAG, "Connected with insecure socket")
        } catch (e1: Exception) {
            Log.w(TAG, "Insecure failed: ${e1.message}")
            try { sock?.close() } catch (_: Exception) {}
            // Attempt 2: secure socket
            try {
                sock = device.createRfcommSocketToServiceRecord(SPP_UUID)
                sock.connect()
                Log.d(TAG, "Connected with secure socket")
            } catch (e2: Exception) {
                Log.w(TAG, "Secure failed: ${e2.message}")
                try { sock?.close() } catch (_: Exception) {}
                // Attempt 3: reflection
                try {
                    val m = device.javaClass.getMethod("createRfcommSocket", Int::class.java)
                    sock = m.invoke(device, 1) as BluetoothSocket
                    sock.connect()
                    Log.d(TAG, "Connected with reflection")
                } catch (e3: Exception) {
                    Log.e(TAG, "All attempts failed: ${e3.message}")
                    return@withContext false
                }
            }
        }
        socket = sock
        outStream = sock!!.outputStream
        Thread.sleep(500)  // Let printer initialize
        isConnected = true
        true
    }

    fun disconnect() {
        try { outStream?.close() } catch (_: Exception) {}
        try { socket?.close() } catch (_: Exception) {}
        outStream = null; socket = null; isConnected = false
    }

    suspend fun sendRaw(tspl: String): Boolean = withContext(Dispatchers.IO) {
        if (!isConnected || outStream == null) return@withContext false
        try {
            outStream!!.write(tspl.toByteArray(Charsets.US_ASCII))
            outStream!!.flush()
            true
        } catch (e: Exception) {
            Log.e(TAG, "Send error: ${e.message}")
            disconnect()
            false
        }
    }
}