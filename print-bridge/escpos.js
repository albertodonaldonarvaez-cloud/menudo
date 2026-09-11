'use strict';
/**
 * ESCPOS.JS — Comandos ESC/POS para impresoras térmicas
 * Compatible con impresoras genéricas 58mm y 80mm
 */

const ESC = 0x1B;
const GS  = 0x1D;

const CMD = {
  init:        Buffer.from([ESC, 0x40]),           // Inicializar impresora
  alignLeft:   Buffer.from([ESC, 0x61, 0x00]),     // Alinear izquierda
  alignCenter: Buffer.from([ESC, 0x61, 0x01]),     // Alinear centro
  alignRight:  Buffer.from([ESC, 0x61, 0x02]),     // Alinear derecha
  boldOn:      Buffer.from([ESC, 0x45, 0x01]),     // Negrita activa
  boldOff:     Buffer.from([ESC, 0x45, 0x00]),     // Negrita inactiva
  sizeNormal:  Buffer.from([GS,  0x21, 0x00]),     // Tamaño normal
  sizeMedium:  Buffer.from([GS,  0x21, 0x01]),     // Doble alto
  sizeLarge:   Buffer.from([GS,  0x21, 0x11]),     // Doble ancho + alto
  cut:         Buffer.from([GS,  0x56, 0x41, 0x03]), // Corte parcial
  beep:        Buffer.from([ESC, 0x42, 0x03, 0x02]), // Pitido (si lo soporta)
  lf:          Buffer.from([0x0A]),                // Salto de linea
  lf2:         Buffer.from([0x0A, 0x0A]),
  lf3:         Buffer.from([0x0A, 0x0A, 0x0A]),
};

/**
 * Convierte texto a buffer con encoding compatible con impresoras latinas.
 * La mayoria de impresoras chinas usan CP437 o Latin1.
 */
function text(str, newLine = true) {
  // Reemplazar caracteres con acento por sus equivalentes simples
  const cleaned = str
    .replace(/á/g, 'a').replace(/é/g, 'e').replace(/í/g, 'i')
    .replace(/ó/g, 'o').replace(/ú/g, 'u').replace(/ü/g, 'u')
    .replace(/Á/g, 'A').replace(/É/g, 'E').replace(/Í/g, 'I')
    .replace(/Ó/g, 'O').replace(/Ú/g, 'U').replace(/Ü/g, 'U')
    .replace(/ñ/g, 'n').replace(/Ñ/g, 'N')
    .replace(/¿/g, '?').replace(/¡/g, '!')
    .replace(/×/g, 'x');
  return Buffer.from(cleaned + (newLine ? '\n' : ''), 'ascii');
}

/**
 * Linea divisoria de guiones
 */
function divider(chars) {
  return text('-'.repeat(chars));
}

/**
 * Linea con texto izquierda y texto derecha justificados
 */
function rowLR(left, right, totalChars) {
  const spaces = totalChars - left.length - right.length;
  const line   = left + ' '.repeat(Math.max(1, spaces)) + right;
  return text(line.slice(0, totalChars));
}

/**
 * Construye el ticket completo de una orden en formato ESC/POS
 * @param {Object} order  - La orden de la API
 * @param {Object} config - Configuracion del bridge (businessName, paperWidth)
 * @returns {Buffer}
 */
function buildTicket(order, config) {
  const chars = config.paperWidth === 80 ? 42 : 32;
  const chunks = [];
  const push = (...bufs) => bufs.forEach(b => chunks.push(b));

  // Inicializar
  push(CMD.init);
  push(CMD.alignCenter);

  // Nombre del negocio
  push(CMD.boldOn, CMD.sizeLarge);
  push(text(config.businessName || 'RESTAURANTE'));
  push(CMD.sizeNormal, CMD.boldOff, CMD.lf);

  // Tipo de orden — grande y visible
  const tipo = order.orderType === 'llevar' ? '** PARA LLEVAR **' : '** CONSUMO AQUI **';
  push(CMD.boldOn, CMD.sizeMedium);
  push(text(tipo));
  push(CMD.sizeNormal, CMD.boldOff);

  // Numero y hora
  const hora = new Date(order.timestamp).toLocaleTimeString('es-MX', {
    hour: '2-digit', minute: '2-digit', hour12: true
  });
  push(CMD.lf);
  push(text(`Orden #${order.num || '-'}  ${hora}`));
  push(CMD.lf);

  // Nombre del cliente — muy visible
  push(CMD.alignLeft, CMD.boldOn, CMD.sizeLarge);
  push(text(order.clientName || 'Cliente'));
  push(CMD.sizeNormal, CMD.boldOff, CMD.lf);
  push(divider(chars));

  // Items
  push(CMD.alignLeft);
  (order.items || []).forEach(item => {
    const qty   = `${item.qty}x`;
    const name  = item.title;
    const price = `$${(Number(item.price) * item.qty).toLocaleString('es-MX')}`;
    push(CMD.boldOn);
    push(rowLR(qty + ' ' + name, price, chars));
    push(CMD.boldOff);
  });

  push(divider(chars));

  // Total
  push(CMD.alignRight, CMD.boldOn, CMD.sizeLarge);
  push(text(`$${Number(order.total).toLocaleString('es-MX')}`));
  push(CMD.sizeNormal, CMD.boldOff, CMD.alignLeft);

  // Espacio y corte
  push(CMD.lf3);
  push(CMD.cut);

  return Buffer.concat(chunks);
}

module.exports = { CMD, text, divider, rowLR, buildTicket };