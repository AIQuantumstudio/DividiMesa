import { Item, ItemMode } from '../types';

export interface ScannedProduct {
  id: number;
  nombre_producto: string;
  cantidad: number;
  precio_unitario_ars: number;
  importe_linea_ars: number;
  moneda: 'ARS';
  confianza_lectura: number;
  requiere_revision: boolean;
  motivo_revision?: string;
  mode: ItemMode;
  shares: Record<number, number>;
}

/**
 * Normalizes number formats from Argentine receipts:
 * "12.500,00", "12500,00", "12,500.00", "12.500", "12500", "3.700", "3700,00"
 * into a standard JavaScript float/number.
 */
export function parsePriceNumber(rawStr: string): number {
  if (!rawStr) return 0;
  let cleaned = rawStr.trim();

  // Strip currency signs ($ or ARS or s/)
  cleaned = cleaned.replace(/(?:\$|ars\b|s\/|\b[sS§]\b)/gi, '').trim();
  // Strip trailing noise characters
  cleaned = cleaned.replace(/[\-_+=:;.]+$/, '').trim();

  // Argentine format with dot for thousands and comma for decimals: e.g. "12.500,00" or "3.700,50"
  if (/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(cleaned)) {
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  }
  // Direct comma for decimals without thousand dots: e.g. "12500,00" or "4000,00" or "7400,00"
  else if (/^\d+,\d{1,2}$/.test(cleaned)) {
    cleaned = cleaned.replace(',', '.');
  }
  // Argentine format with thousand dots and no decimals: e.g. "12.500", "24.900", "1.500.000"
  else if (/^\d{1,3}(\.\d{3})+$/.test(cleaned)) {
    cleaned = cleaned.replace(/\./g, '');
  }
  // US format with comma for thousands and dot for decimals: e.g. "12,500.00"
  else if (/^\d{1,3}(,\d{3})+(\.\d{1,2})?$/.test(cleaned)) {
    cleaned = cleaned.replace(/,/g, '');
  }
  // Plain numbers or already standard decimals
  else {
    cleaned = cleaned.replace(/[^0-9.]/g, '');
  }

  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : Math.round(num * 100) / 100;
}

/**
 * Checks if a line is a header, separator, metadata or non-product fiscal footer.
 * Note: Never ignores products like "SERVICIO DE MESA" or "CUBIERTO".
 */
function isIgnoredLine(line: string): boolean {
  const lower = line.toLowerCase().trim();

  // Ignore separator lines (---, ===, ***)
  if (/^[\-_=*.~]{3,}$/.test(lower)) return true;

  // Header patterns (table, waiter, cashier metadata)
  if (/^(?:nro\.?\s*)?mesa\s*:\s*\d+/i.test(lower)) return true;
  if (/^(?:nro\.?\s*)?mozo\s*:\s*\d+/i.test(lower)) return true;
  if (/^(?:terminal|caja|sucursal|operacion|ticket\s*n|factura\s*[a-c]|comprobante)\b/i.test(lower)) return true;
  if (/^(?:cuit|i\.?v\.?a\.?\s*responsable|ingresos\s*brutos|inicio\s*actividades)\b/i.test(lower)) return true;
  if (/^(?:fecha|hora|tel|telefono|direccion|localidad)\b/i.test(lower)) return true;

  // Column header lines
  if (/^(?:canti|cant|cantidad)\b.*(?:unitario|descripcion|importe)/i.test(lower)) return true;
  if (/^(?:descripcion|detalle)\b.*(?:importe|precio|total)/i.test(lower)) return true;
  if (/^(?:unitario|p\.unit)\b.*(?:iva|importe)/i.test(lower)) return true;

  // Footer/totals lines
  if (/^(?:subtotal|total|iva\s*\d*%?|total\s*a\s*pagar|importe\s*total)\b/i.test(lower)) return true;
  if (/^(?:cambio|efectivo|tarjeta|propina|debito|credito|visa|mastercard|mercadopago|gracias|visita|fiscal)\b/i.test(lower)) return true;

  return false;
}

/**
 * Regex for sublines that indicate unit price:
 * e.g. "Unit: 2000,00 (21,00)" or "P.Unit: 3700.00" or "x 2500,00" or "Unit 2500,00"
 */
const SUBLINE_UNIT_REGEX = /^(?:unit(?:ario|\.?)?:?|p\.?\s*unit(?:ario|\.?)?:?|x\s*[$sS§]?)\s*([0-9]+(?:[.,][0-9]+)*)(?:\s*\(\s*([0-9]+(?:[.,][0-9]+)*)\s*%?\s*\))?/i;

/**
 * Parses receipt OCR text into structured items with independent unit price,
 * line total, quantity, and validation status.
 */
export function parseReceiptText(text: string): Item[] {
  if (!text || !text.trim()) return [];

  const rawLines = text
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0);

  const items: Item[] = [];

  for (let i = 0; i < rawLines.length; i++) {
    let line = rawLines[i];

    if (isIgnoredLine(line)) {
      continue;
    }

    // 1. Check if this line is a SUBLINE for the preceding item:
    // e.g. "Unit: 2000,00 (21,00)"
    const sublineMatch = line.match(SUBLINE_UNIT_REGEX);
    if (sublineMatch && items.length > 0) {
      const prevItem = items[items.length - 1];
      const parsedUnit = parsePriceNumber(sublineMatch[1]);
      if (parsedUnit > 0) {
        prevItem.price = parsedUnit; // Set exact unit price from ticket

        if (sublineMatch[2]) {
          const parsedVat = parsePriceNumber(sublineMatch[2]);
          if (parsedVat > 0) {
            prevItem.vatPercentage = parsedVat;
          }
        }

        // Validate math: does cantidad × precio_unitario === importe_linea?
        const expectedTotal = Math.round(prevItem.qty * prevItem.price * 100) / 100;
        const diff = Math.abs(expectedTotal - (prevItem.lineTotal ?? (prevItem.price * prevItem.qty)));

        if (diff <= 1) {
          prevItem.confidence = 1.0;
          prevItem.needsReview = false;
          prevItem.reviewReason = undefined;
        } else {
          prevItem.confidence = 0.75;
          prevItem.needsReview = true;
          prevItem.reviewReason = `Importe ($${prevItem.lineTotal}) difiere de Cantidad (${prevItem.qty}) × P. Unitario ($${prevItem.price}). Posible promo o descuento.`;
        }
        continue;
      }
    }

    // 2. Parse main product line:
    // Price match at the end of the line: e.g. "4000,00", "$ 18500", "11000,00", "5000,00.-"
    // Use word boundary \b so words ending in 's' (e.g. PARMES, PAPAS) are not truncated!
    const priceMatch = line.match(/(?:(?:\$|ars\b|s\/|\b[sS§]\b)\s*)?([0-9]+(?:[.,][0-9]+)*)(?:\s*[\-_.*])?\s*$/);
    if (!priceMatch) continue;

    const rawPrice = priceMatch[1];
    const fullPriceNum = parsePriceNumber(rawPrice);
    if (fullPriceNum <= 0) continue;

    let restOfLine = line.slice(0, priceMatch.index).trim();
    // Clean trailing dots or dashes often used as leaders in receipts
    restOfLine = restOfLine.replace(/[\.\-_+=:;|~]+$/, '').trim();
    if (!restOfLine || restOfLine.length < 2) continue;

    // Check if restOfLine also has an inline unit price before the total:
    // e.g. "2 AGUA MINERAL 3700,00" or "AGUA MINERAL 2 x 3700,00"
    // Extract quantity if present at start (e.g. "2  SERVICIO DE MESA", "1x COCA COLA", "1 PROMO CERVEZA 2X1")
    let qty = 1;
    let name = restOfLine;

    const qtyStartMatch = restOfLine.match(/^([0-9]{1,2})\s*(?:[xX*]|[-–])?\s+(.+)$/);
    if (qtyStartMatch) {
      const parsedQty = parseInt(qtyStartMatch[1], 10);
      if (parsedQty > 0 && parsedQty <= 99) {
        qty = parsedQty;
        name = qtyStartMatch[2].trim();
      }
    } else {
      // Quantity at end of description e.g. "EMPANADAS x 2"
      const qtySuffixMatch = restOfLine.match(/^(.+?)\s+[xX*]\s*([0-9]{1,2})$/);
      if (qtySuffixMatch) {
        const parsedQty = parseInt(qtySuffixMatch[2], 10);
        if (parsedQty > 0 && parsedQty <= 99) {
          qty = parsedQty;
          name = qtySuffixMatch[1].trim();
        }
      }
    }

    let inlineUnitPrice: number | null = null;

    // Check for inline unit price in the remaining text, e.g. "AGUA MINERAL Unit: 3700,00" or "AGUA MINERAL x 3700,00"
    const inlineUnitMatch = name.match(/(?:unit(?:ario|\.?)?:?|p\.?\s*unit(?:ario|\.?)?:?|x\s*|c\/u\s*)\s*([0-9]+(?:[.,][0-9]+)*)\s*$/i);
    if (inlineUnitMatch && inlineUnitMatch.index && inlineUnitMatch.index >= 2) {
      const candidateUnit = parsePriceNumber(inlineUnitMatch[1]);
      if (candidateUnit >= 50 && candidateUnit <= fullPriceNum) {
        inlineUnitPrice = candidateUnit;
        name = name.slice(0, inlineUnitMatch.index).trim().replace(/[\.\-_+=:;|~]+$/, '').trim();
      }
    }

    // Clean up product name
    name = name
      .replace(/^[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ]+/, '')
      .replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ%()]+$/, '')
      .trim();

    if (name.length < 2) continue;

    // Determine unit price and line total:
    let lineTotal = fullPriceNum;
    let unitPrice = fullPriceNum;
    let confidence = 0.9;
    let needsReview = false;
    let reviewReason: string | undefined = undefined;

    if (inlineUnitPrice !== null) {
      unitPrice = inlineUnitPrice;
      lineTotal = fullPriceNum;
      const expectedTotal = Math.round(qty * unitPrice * 100) / 100;
      if (Math.abs(expectedTotal - lineTotal) <= 1) {
        confidence = 1.0;
        needsReview = false;
      } else {
        confidence = 0.75;
        needsReview = true;
        reviewReason = `El importe ($${lineTotal}) difiere de Cantidad (${qty}) × P. Unitario ($${unitPrice})`;
      }
    } else if (qty > 1) {
      // If quantity > 1 and only line total was given on this line,
      // calculate unit price as lineTotal / qty as initial baseline.
      unitPrice = Math.round((lineTotal / qty) * 100) / 100;
      confidence = 0.9;
    } else {
      // qty === 1: unit price and line total are equal
      unitPrice = lineTotal;
      confidence = 1.0;
    }

    const isBeverage = /(vino|cerveza|gaseosa|coca|agua|jarra|champagne|fernet|aperol|trago|botella)/i.test(name);
    const mode: ItemMode = isBeverage ? 'shared' : 'units';

    items.push({
      id: Date.now() + i * 10,
      name,
      qty,
      price: unitPrice,
      lineTotal,
      currency: 'ARS',
      confidence,
      needsReview,
      reviewReason,
      mode,
      shares: {}
    });
  }

  return items;
}

/**
 * Converts an Item to the explicit ScannedProduct structured schema.
 */
export function toScannedProduct(it: Item): ScannedProduct {
  return {
    id: it.id,
    nombre_producto: it.name,
    cantidad: it.qty,
    precio_unitario_ars: it.price,
    importe_linea_ars: it.lineTotal ?? it.price * it.qty,
    moneda: 'ARS',
    confianza_lectura: it.confidence ?? 1.0,
    requiere_revision: it.needsReview ?? false,
    motivo_revision: it.reviewReason,
    mode: it.mode,
    shares: it.shares
  };
}
