package com.menudo.printer

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
}