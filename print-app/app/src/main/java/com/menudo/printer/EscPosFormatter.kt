package com.menudo.printer

import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

object EscPosFormatter {
    private const val LINE_CHARS = 32
    private const val LINE = "================================"
    private const val DASH = "--------------------------------"

    private fun center(text: String): String {
        if (text.length >= LINE_CHARS) return text
        val pad = (LINE_CHARS - text.length) / 2
        return " ".repeat(pad) + text
    }

    fun formatOrder(order: OrderPoller.Order): ByteArray {
        val sb = StringBuilder()

        sb.appendLine(LINE)
        sb.appendLine(center("MENUDERIA Y BARBACOA"))
        sb.appendLine(LINE)
        sb.appendLine("  COMANDA #${order.num}")
        sb.appendLine("  Cliente: ${order.clientName}")
        sb.appendLine("  Tipo: ${order.orderType.uppercase()}")

        val timeFormat = SimpleDateFormat("h:mm a", Locale.US)
        var timeStr = "Ahora"
        try {
            val isoFormat = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US)
            isoFormat.timeZone = TimeZone.getTimeZone("UTC")
            val date = isoFormat.parse(order.timestamp)
            if (date != null) {
                timeFormat.timeZone = TimeZone.getDefault()
                timeStr = timeFormat.format(date)
            }
        } catch (_: Exception) {}

        sb.appendLine("  Hora: $timeStr")
        sb.appendLine(DASH)

        for (item in order.items) {
            val line = "  ${item.qty}x ${item.title}"
            if (line.length > LINE_CHARS) {
                sb.appendLine(line.substring(0, LINE_CHARS))
                sb.appendLine("    ${line.substring(LINE_CHARS)}")
            } else {
                sb.appendLine(line)
            }
        }

        sb.appendLine(DASH)
        sb.appendLine("  TOTAL: $${order.total}")
        sb.appendLine(LINE)
        sb.appendLine()
        sb.appendLine()
        sb.appendLine()

        // ESC @ (init) + text + LF feed
        val init = byteArrayOf(0x1B, 0x40)
        val textBytes = sb.toString().toByteArray(Charsets.ISO_8859_1)
        val feed = byteArrayOf(0x1B, 0x64, 0x04) // ESC d 4 = feed 4 lines

        return init + textBytes + feed
    }

    fun formatTest(): ByteArray {
        val sb = StringBuilder()
        sb.appendLine(LINE)
        sb.appendLine(center("PRUEBA DE IMPRESION"))
        sb.appendLine(LINE)
        sb.appendLine()
        sb.appendLine(center("Menudo Printer App"))
        sb.appendLine(center("Conexion exitosa!"))
        sb.appendLine()

        val timeFormat = SimpleDateFormat("dd/MM/yyyy h:mm a", Locale.US)
        sb.appendLine(center(timeFormat.format(Date())))

        sb.appendLine()
        sb.appendLine(LINE)
        sb.appendLine()
        sb.appendLine()

        val init = byteArrayOf(0x1B, 0x40)
        val textBytes = sb.toString().toByteArray(Charsets.ISO_8859_1)
        val feed = byteArrayOf(0x1B, 0x64, 0x04)

        return init + textBytes + feed
    }
}