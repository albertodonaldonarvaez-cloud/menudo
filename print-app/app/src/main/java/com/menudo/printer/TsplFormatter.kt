package com.menudo.printer

import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

object TsplFormatter {

    // Ancho imprimible: 384 dots (48mm × 8 dots/mm)
    // Font "2" (12×20): 32 chars max
    // Font "3" (16×24): 24 chars max
    // Font "4" (24×32): 16 chars max

    private fun maxChars(font: String): Int = when (font) {
        "1" -> 48; "2" -> 32; "3" -> 24; "4" -> 16; "5" -> 12; else -> 24
    }

    private fun fontHeight(font: String): Int = when (font) {
        "5" -> 56; "4" -> 40; "3" -> 30; "2" -> 24; else -> 30
    }

    // ── COMANDA DE COCINA ─────────────────────────────────────────
    fun formatComanda(order: OrderPoller.Order, copies: Int = 1): String {
        val lines = mutableListOf<Triple<Int, String, String>>()
        var y = 10

        fun add(text: String, font: String) {
            lines.add(Triple(y, font, sanitize(text).take(maxChars(font))))
            y += fontHeight(font)
        }
        fun addWrap(text: String, font: String) {
            val safe = sanitize(text)
            val max = maxChars(font)
            if (safe.length <= max) {
                add(safe, font)
            } else {
                add(safe.substring(0, max), font)
                add("  " + safe.substring(max).take(max - 2), font)
            }
        }
        fun sep() { add("================================", "2") }
        fun dash() { add("--------------------------------", "2") }

        sep()
        add("MENUDERIA Y BARBACOA", "3")
        sep()

        add("COMANDA #${order.num}", "4")
        addWrap("${order.clientName}", "3")

        val typeLabel = if (order.orderType == "llevar") "PARA LLEVAR" else "AQUI"
        val timeStr = formatTime(order.timestamp)
        add("$typeLabel | $timeStr", "2")

        dash()
        for (item in order.items) {
            addWrap("${item.qty}x ${item.title}", "3")
        }
        dash()

        add("TOTAL: \$${order.total}", "3")
        sep()

        y += 20
        return buildTspl(lines, y)
    }

    // ── COMANDA ADICIONAL (EXCEDENTE) ─────────────────────────────
    fun formatComandaAddition(comanda: OrderPoller.ComandaAddition): String {
        val lines = mutableListOf<Triple<Int, String, String>>()
        var y = 10

        fun add(text: String, font: String) {
            lines.add(Triple(y, font, sanitize(text).take(maxChars(font))))
            y += fontHeight(font)
        }
        fun addWrap(text: String, font: String) {
            val safe = sanitize(text)
            val max = maxChars(font)
            if (safe.length <= max) {
                add(safe, font)
            } else {
                add(safe.substring(0, max), font)
                add("  " + safe.substring(max).take(max - 2), font)
            }
        }
        fun sep() { add("================================", "2") }
        fun dash() { add("--------------------------------", "2") }

        sep()
        add("** ADICIONAL **", "4")
        add("COMANDA #${comanda.num}", "3")
        sep()

        addWrap("${comanda.clientName}", "3")

        val typeLabel = if (comanda.orderType == "llevar") "LLEVAR" else "AQUI"
        val timeStr = formatTime(comanda.timestamp)
        add("$typeLabel | $timeStr", "2")

        dash()
        add("ITEMS NUEVOS:", "3")
        dash()
        for (item in comanda.items) {
            addWrap("${item.qty}x ${item.title}", "3")
        }
        dash()

        add("SUBTOTAL: \$${comanda.total}", "3")
        sep()

        y += 20
        return buildTspl(lines, y)
    }

    // ── TICKET DE VENTA (COBRO) ───────────────────────────────────
    fun formatTicketFromJson(ticket: OrderPoller.TicketData): String {
        val lines = mutableListOf<Triple<Int, String, String>>()
        var y = 10

        fun add(text: String, font: String) {
            lines.add(Triple(y, font, sanitize(text).take(maxChars(font))))
            y += fontHeight(font)
        }
        fun addWrap(text: String, font: String) {
            val safe = sanitize(text)
            val max = maxChars(font)
            if (safe.length <= max) {
                add(safe, font)
            } else {
                add(safe.substring(0, max), font)
                add("  " + safe.substring(max).take(max - 2), font)
            }
        }
        fun sep() { add("================================", "2") }
        fun dash() { add("--------------------------------", "2") }

        sep()
        add("MENUDERIA Y BARBACOA", "3")
        sep()

        add("TICKET DE VENTA", "4")
        addWrap("${ticket.clientName}", "3")

        val timeStr = formatTime(ticket.timestamp)
        add("Fecha: $timeStr", "2")

        val methodLabel = when(ticket.payMethod) {
            "efectivo" -> "Efectivo"
            "tarjeta" -> "Tarjeta"
            "transferencia" -> "Transferencia"
            else -> ticket.payMethod
        }
        add("Pago: $methodLabel", "3")

        dash()
        for (item in ticket.items) {
            addWrap("${item.qty}x ${item.title}", "3")
        }
        dash()

        add("TOTAL: \$${ticket.total}", "3")

        if (ticket.payMethod == "efectivo" && ticket.received > 0) {
            val recInt = ticket.received.toInt()
            val chgInt = ticket.change.toInt()
            add("Recibido: \$$recInt", "2")
            add("CAMBIO: \$$chgInt", "3")
        }

        sep()
        add("Gracias por su visita!", "3")
        sep()

        y += 20
        return buildTspl(lines, y)
    }

    // ── TEST DE IMPRESION ─────────────────────────────────────────
    fun formatTest(): String {
        val now = SimpleDateFormat("dd/MM/yyyy h:mm a", Locale.US).format(Date())
        return buildString {
            appendLine("SIZE 48 mm,50 mm")
            appendLine("GAP 0 mm,0 mm")
            appendLine("DIRECTION 0")
            appendLine("CLS")
            appendLine("TEXT 0,10,\"2\",0,1,1,\"================================\"")
            appendLine("TEXT 0,34,\"3\",0,1,1,\"PRUEBA DE IMPRESION\"")
            appendLine("TEXT 0,74,\"2\",0,1,1,\"================================\"")
            appendLine("TEXT 0,100,\"3\",0,1,1,\"Menudo Printer App\"")
            appendLine("TEXT 0,130,\"3\",0,1,1,\"Conexion: OK\"")
            appendLine("TEXT 0,160,\"2\",0,1,1,\"$now\"")
            appendLine("TEXT 0,184,\"2\",0,1,1,\"================================\"")
            appendLine("PRINT 1,1")
        }
    }

    // ── Helpers ───────────────────────────────────────────────────
    private fun buildTspl(lines: List<Triple<Int, String, String>>, totalY: Int): String {
        val heightMm = maxOf((totalY / 8.0).toInt() + 2, 40)
        return buildString {
            appendLine("SIZE 48 mm,$heightMm mm")
            appendLine("GAP 0 mm,0 mm")
            appendLine("DIRECTION 0")
            appendLine("CLS")
            for (line in lines) {
                appendLine("TEXT 0,${line.first},\"${line.second}\",0,1,1,\"${line.third}\"")
            }
            appendLine("PRINT 1,1")
        }
    }

    private fun sanitize(text: String): String {
        return text.replace("\"", "'")
            .replace("\\", "")
            .replace("\n", " ")
            .replace("\r", "")
    }

    private fun formatTime(isoTimestamp: String): String {
        return try {
            val isoFormat = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US)
            isoFormat.timeZone = TimeZone.getTimeZone("UTC")
            val date = isoFormat.parse(isoTimestamp)
            if (date != null) {
                val outFormat = SimpleDateFormat("dd/MMM h:mm a", Locale("es", "MX"))
                outFormat.timeZone = TimeZone.getDefault()
                outFormat.format(date)
            } else isoTimestamp
        } catch (_: Exception) {
            try {
                val isoFormat2 = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US)
                val date2 = isoFormat2.parse(isoTimestamp)
                if (date2 != null) {
                    SimpleDateFormat("dd/MMM h:mm a", Locale("es", "MX")).format(date2)
                } else isoTimestamp
            } catch (_: Exception) { isoTimestamp }
        }
    }
}
