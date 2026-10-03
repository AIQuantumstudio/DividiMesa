import { Item } from '../types';

const IGNORED_WORDS = [
  'subtotal',
  'total',
  'iva',
  'cuit',
  'fecha',
  'hora',
  'ticket',
  'factura',
  'mozo',
  'mesa',
  'gracias',
  'visita',
  'fiscal',
  'cambio',
  'efectivo',
  'tarjeta',
  'propina',
  'ingresos brutos',
  'i.v.a',
  'caja',
  'sucursal',
  'terminal',
  'operacion',
  'visa',
  'mastercard',
  'debito',
  'credito',
  'telefono',
  'tel:',
  'pago',
  'consumo',
  'descuento',
  'recargo',
  'importe',
  'cant',
  'descripcion',
  'p.unit',
  'precio'
];

/**
 * Normalizes number formats like "12.500,00", "12500.00", "12,500", "4500" into a standard JavaScript number
 */
export function parsePriceNumber(rawStr: string): number {
  let cleaned = rawStr.trim().replace(/[$sS]/g, '').trim();

  // If format is like 12.500,00 or 1.250,50
  if (/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(cleaned)) {
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  }
  // If format is like 12,500.00
  else if (/^\d{1,3}(,\d{3})+(\.\d{1,2})?$/.test(cleaned)) {
    cleaned = cleaned.replace(/,/g, '');
  }
  // If format is like 12500,50
  else if (/^\d+,\d{1,2}$/.test(cleaned)) {
    cleaned = cleaned.replace(',', '.');
  }
  // If format is like 12.500 (Argentine peso without decimals)
  else if (/^\d{1,3}\.\d{3}$/.test(cleaned)) {
    cleaned = cleaned.replace(/\./g, '');
  }
  // Plain numbers or standard decimals
  else {
    cleaned = cleaned.replace(/[^0-9.]/g, '');
  }

  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : Math.round(num * 100) / 100;
}

export function parseReceiptText(text: string): Item[] {
  if (!text || !text.trim()) return [];

  const rawLines = text.split('\n');
  const items: Item[] = [];

  for (let i = 0; i < rawLines.length; i++) {
    let line = rawLines[i].trim();
    if (line.length < 3) continue;

    const lower = line.toLowerCase();

    // Check if line contains ignored header/footer keyword
    const isIgnored = IGNORED_WORDS.some(word => {
      // check exact word or boundary
      const regex = new RegExp(`\\b${word}\\b`, 'i');
      return regex.test(lower);
    });

    if (isIgnored) continue;

    // Look for prices: numbers usually at the end of the line
    // e.g. "2 Empanada Carne 3.600,00" or "Bife de Chorizo $ 18500"
    const priceMatch = line.match(/(?:[$sS]\s*)?([0-9]{1,3}(?:[.,][0-9]{3})*(?:[.,][0-9]{1,2})?|[0-9]{3,7}(?:[.,][0-9]{1,2})?)\s*$/);

    if (!priceMatch) continue;

    const rawPrice = priceMatch[1];
    const fullPriceNum = parsePriceNumber(rawPrice);

    if (fullPriceNum <= 0) continue;

    // Remove price from line
    let restOfLine = line.slice(0, priceMatch.index).trim();
    // Clean up trailing dots or dashes often present in receipts (e.g. "Milanesa Napo ...... ")
    restOfLine = restOfLine.replace(/[\.\-_+=:;]+$/, '').trim();

    if (!restOfLine || restOfLine.length < 2) continue;

    // Extract quantity if present at start (e.g. "2 EMPANADA", "1x COCA COLA", "3 - AGUA")
    let qty = 1;
    const qtyMatch = restOfLine.match(/^([0-9]{1,2})\s*(?:[xX*]|[-–])?\s+(.+)$/);
    let name = restOfLine;

    if (qtyMatch) {
      const parsedQty = parseInt(qtyMatch[1], 10);
      if (parsedQty > 0 && parsedQty <= 99) {
        qty = parsedQty;
        name = qtyMatch[2].trim();
      }
    }

    // Clean up name
    name = name
      .replace(/^[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ]+/, '')
      .replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ%()]+$/, '')
      .trim();

    if (name.length < 2) continue;

    // Calculate unit price: if quantity > 1, check if fullPriceNum is total or unit price
    // Usually receipts print either unit price or line total. If fullPriceNum is high, it's line total.
    let unitPrice = fullPriceNum;
    if (qty > 1) {
      unitPrice = Math.round((fullPriceNum / qty) * 100) / 100;
    }

    // Guess mode: beverages and wine often shared, food portions units
    const isBeverage = /(vino|cerveza|gaseosa|coca|agua|jarra|champagne|fernet|aperol)/i.test(name);
    const mode = isBeverage ? 'shared' : 'units';

    items.push({
      id: Date.now() + i * 10,
      name,
      price: unitPrice,
      qty,
      mode,
      shares: {}
    });
  }

  return items;
}
