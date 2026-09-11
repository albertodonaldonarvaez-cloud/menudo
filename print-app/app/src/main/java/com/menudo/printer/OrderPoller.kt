package com.menudo.printer

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
}