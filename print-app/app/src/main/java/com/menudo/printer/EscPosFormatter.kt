package com.menudo.printer

import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

object EscPosFormatter {
    private const val LINE_CHARS = 32

    fun formatOrder(order: OrderPoller.Order): ByteArray {
        val builder = StringBuilder()
        
        builder.append("================================
")
        builder.append("    MENUDERÍA Y BARBACOA
")
        builder.append("================================
")
        
        builder.append("  COMANDA #${order.num}
")
        builder.append("  Cliente: ${order.clientName}
")
        builder.append("  Tipo: ${order.orderType.uppercase()}
")
        
        val timeFormat = SimpleDateFormat("h:mm a", Locale.US)
        var timeStr = "Desconocida"
        try {
            val date = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).parse(order.timestamp)
            if (date != null) timeStr = timeFormat.format(date)
        } catch (e: Exception) {}
        
        builder.append("  Hora: $timeStr
")
        builder.append("--------------------------------
")
        
        for (item in order.items) {
            val qtyStr = "${item.qty}x "
            val titleStr = item.title
            val line = "  $qtyStr$titleStr"
            builder.append(line)
            if (line.length > LINE_CHARS) {
                builder.append("
")
            } else {
                builder.append("
")
            }
        }
        
        builder.append("--------------------------------
")
        builder.append("  TOTAL: $${order.total}
")
        builder.append("================================




")

        val textBytes = builder.toString().toByteArray(Charsets.ISO_8859_1) // Use ISO for ESC/POS generally
        
        // Init printer + Text + Cut/Feed
        val init = byteArrayOf(0x1B, 0x40) // ESC @
        
        val result = ByteArray(init.size + textBytes.size)
        System.arraycopy(init, 0, result, 0, init.size)
        System.arraycopy(textBytes, 0, result, init.size, textBytes.size)
        
        return result
    }
    
    fun formatTest(): ByteArray {
        val text = "================================
" +
                   "      PRUEBA DE IMPRESION
" +
                   "================================




"
        val init = byteArrayOf(0x1B, 0x40) // ESC @
        val textBytes = text.toByteArray(Charsets.ISO_8859_1)
        val result = ByteArray(init.size + textBytes.size)
        System.arraycopy(init, 0, result, 0, init.size)
        System.arraycopy(textBytes, 0, result, init.size, textBytes.size)
        return result
    }
}