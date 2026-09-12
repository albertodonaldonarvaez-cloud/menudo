package com.menudo.printer

import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

object TsplFormatter {

    // Ancho imprimible: 384 dots (48mm × 8 dots/mm)
    // Font "2" (12×20): 32 chars max    → body text, separadores
    // Font "3" (16×24): 24 chars max    → info principal
    // Font "4" (24×32): 16 chars max    → titulos, totales
    // Font "5" (32×48): 12 chars max    → encabezados grandes

    private fun maxChars(font: String): Int = when (font) {
        "1" -> 48; "2" -> 32; "3" -> 24; "4" -> 16; "5" -> 12; else -> 24
    }

    // ── COMANDA DE COCINA ─────────────────────────────────────────
    fun formatComanda(order: OrderPoller.Order, copies: Int = 1): String {
        return buildString {
            val lines = mutableListOf<Triple<Int, String, String>>()
            var y = 10

            fun addLine(text: String, font: String) {
                val h = when (font) {
                    "5" -> 56; "4" -> 40; "3" -> 30; "2" -> 24; else -> 30
                }
                val safe = sanitize(text).take(maxChars(font))
                lines.add(Triple(y, font, safe))
                y += h
            }

            fun sep() { addLine("================================", "2") }
            fun dash() { addLine("--------------------------------", "2") }

            sep()
            addLine("MENUDERIA Y BARBACOA", "3")
            sep()

            addLine("COMANDA #${order.num}", "4")
            addLine("${order.clientName}", "3")

            val typeLabel = if (order.orderType == "llevar") "PARA LLEVAR" else "AQUI"
            val timeStr = formatTime(order.timestamp)
            addLine("$typeLabel | $timeStr", "2")

            dash()
            for (item in order.items) {
                addLine("${item.qty}x ${item.title}", "3")
            }
            dash()

            addLine("TOTAL: \$${order.total}", "3")
            sep()

            y += 20
            val heightMm = maxOf((y / 8.0).toInt() + 2, 40)

            appendLine("SIZE 48 mm,$heightMm mm")
            appendLine("GAP 0 mm,0 mm")
            appendLine("DIRECTION 0")
            appendLine("CLS")

            for (line in lines) {
                appendLine("TEXT 0,${line.first},\"${line.second}\",0,1,1,\"${line.third}\"")
            }

            // Siempre PRINT 1 — las copias se manejan en PrintService con delay
            appendLine("PRINT 1,1")
        }
    }

    // ── COMANDA ADICIONAL (EXCEDENTE) ─────────────────────────────
    fun formatComandaAddition(comanda: OrderPoller.ComandaAddition): String {
        return buildString {
            val lines = mutableListOf<Triple<Int, String, String>>()
            var y = 10

            fun addLine(text: String, font: String) {
                val h = when (font) {
                    "5" -> 56; "4" -> 40; "3" -> 30; "2" -> 24; else -> 30
                }
                val safe = sanitize(text).take(maxChars(font))
                lines.add(Triple(y, font, safe))
                y += h
            }

            fun sep() { addLine("================================", "2") }
            fun dash() { addLine("--------------------------------", "2") }

            sep()
            addLine("** ADICIONAL **", "4")
            addLine("COMANDA #${comanda.num}", "3")
            sep()

            addLine("${comanda.clientName}", "3")

            val typeLabel = if (comanda.orderType == "llevar") "LLEVAR" else "AQUI"
            val timeStr = formatTime(comanda.timestamp)
            addLine("$typeLabel | $timeStr", "2")

            dash()
            addLine("ITEMS NUEVOS:", "3")
            dash()
            for (item in comanda.items) {
                addLine("${item.qty}x ${item.title}", "3")
            }
            dash()

            addLine("SUBTOTAL: \$${comanda.total}", "3")
            sep()

            y += 20
            val heightMm = maxOf((y / 8.0).toInt() + 2, 40)

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

    // ── TICKET DE VENTA (COBRO) ───────────────────────────────────
    fun formatTicketFromJson(ticket: OrderPoller.TicketData): String {
        return buildString {
            val lines = mutableListOf<Triple<Int, String, String>>()
            var y = 10

            fun addLine(text: String, font: String) {
                val h = when (font) {
                    "5" -> 56; "4" -> 40; "3" -> 30; "2" -> 24; else -> 30
                }
                val safe = sanitize(text).take(maxChars(font))
                lines.add(Triple(y, font, safe))
                y += h
            }

            fun sep() { addLine("================================", "2") }
            fun dash() { addLine("--------------------------------", "2") }

            sep()
            addLine("MENUDERIA Y BARBACOA", "3")
            sep()

            addLine("TICKET DE VENTA", "4")
            addLine("${ticket.clientName}", "3")

            val timeStr = formatTime(ticket.timestamp)
            addLine("Fecha: $timeStr", "2")

            val methodLabel = when(ticket.payMethod) {
                "efectivo" -> "Efectivo"
                "tarjeta" -> "Tarjeta"
                "transferencia" -> "Transferencia"
                else -> ticket.payMethod
            }
            addLine("Pago: $methodLabel", "3")

            dash()
            for (item in ticket.items) {
                addLine("${item.qty}x ${item.title}", "3")
            }
            dash()

            addLine("TOTAL: \$${ticket.total}", "3")

            if (ticket.payMethod == "efectivo" && ticket.received > 0) {
                val recInt = ticket.received.toInt()
                val chgInt = ticket.change.toInt()
                addLine("Recibido: \$$recInt", "2")
                addLine("CAMBIO: \$$chgInt", "3")
            }

            sep()
            addLine("Gracias por su visita!", "3")
            sep()

            y += 20
            val heightMm = maxOf((y / 8.0).toInt() + 2, 40)

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
