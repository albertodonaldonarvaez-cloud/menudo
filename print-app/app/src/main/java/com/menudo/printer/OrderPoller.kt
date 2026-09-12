package com.menudo.printer

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
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
        val items: List<OrderItem>,
        val printCopies: Int = 1
    )

    data class OrderItem(
        val title: String,
        val qty: Int,
        val price: Int = 0,
        val subtotal: Int = 0
    )

    data class TicketData(
        val orderId: String?,
        val clientName: String,
        val items: List<OrderItem>,
        val total: Int,
        val payMethod: String,
        val received: Double,
        val change: Double,
        val timestamp: String
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
                val itemsArray = obj.optJSONArray("items")
                val itemsList = mutableListOf<OrderItem>()
                if (itemsArray != null) {
                    for (j in 0 until itemsArray.length()) {
                        val itemObj = itemsArray.getJSONObject(j)
                        itemsList.add(OrderItem(
                            title = itemObj.optString("title", "Item"),
                            qty = itemObj.optInt("qty", 1),
                            price = itemObj.optInt("price", 0),
                            subtotal = itemObj.optInt("subtotal", 0)
                        ))
                    }
                }

                orders.add(Order(
                    id = obj.getString("id"),
                    num = obj.getInt("num"),
                    clientName = obj.optString("clientName", "Desconocido"),
                    orderType = obj.optString("orderType", "aqui"),
                    total = obj.optInt("total", 0),
                    timestamp = obj.optString("timestamp", ""),
                    items = itemsList,
                    printCopies = obj.optInt("printCopies", 1)
                ))
            }
            return@withContext orders
        } catch (e: Exception) {
            e.printStackTrace()
            return@withContext emptyList()
        }
    }

    suspend fun fetchPrintQueue(): List<TicketData> = withContext(Dispatchers.IO) {
        val url = prefs.serverUrl.trimEnd('/') + "/api/print-queue"
        val request = Request.Builder().url(url).build()

        try {
            val response = client.newCall(request).execute()
            if (!response.isSuccessful) return@withContext emptyList()

            val body = response.body?.string() ?: return@withContext emptyList()
            val json = JSONObject(body)
            val pendingArray = json.optJSONArray("pending") ?: return@withContext emptyList()

            val tickets = mutableListOf<TicketData>()
            for (i in 0 until pendingArray.length()) {
                val obj = pendingArray.getJSONObject(i)
                val itemsArray = obj.optJSONArray("items")
                val itemsList = mutableListOf<OrderItem>()
                if (itemsArray != null) {
                    for (j in 0 until itemsArray.length()) {
                        val itemObj = itemsArray.getJSONObject(j)
                        itemsList.add(OrderItem(
                            title = itemObj.optString("title", "Item"),
                            qty = itemObj.optInt("qty", 1),
                            price = itemObj.optInt("price", 0),
                            subtotal = itemObj.optInt("subtotal", 0)
                        ))
                    }
                }

                tickets.add(TicketData(
                    orderId = obj.optString("orderId", null),
                    clientName = obj.optString("clientName", ""),
                    items = itemsList,
                    total = obj.optInt("total", 0),
                    payMethod = obj.optString("payMethod", "efectivo"),
                    received = obj.optDouble("received", 0.0),
                    change = obj.optDouble("change", 0.0),
                    timestamp = obj.optString("timestamp", "")
                ))
            }
            return@withContext tickets
        } catch (e: Exception) {
            e.printStackTrace()
            return@withContext emptyList()
        }
    }

    suspend fun ackPrintQueue(ids: List<String>) = withContext(Dispatchers.IO) {
        val url = prefs.serverUrl.trimEnd('/') + "/api/print-queue/ack"
        val jsonBody = JSONObject()
        jsonBody.put("ids", JSONArray(ids))
        val mediaType = "application/json".toMediaType()
        val requestBody = jsonBody.toString().toRequestBody(mediaType)
        val request = Request.Builder().url(url).patch(requestBody).build()

        try {
            client.newCall(request).execute()
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }
}