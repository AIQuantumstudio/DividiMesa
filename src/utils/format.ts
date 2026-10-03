import { Diner, Item, TableTotals, DinerTotals } from '../types';

export const money = (n: number): string => {
  return '$' + Math.round(n).toLocaleString('es-AR');
};

export const fmtU = (n: number): string => {
  return Number.isInteger(n) ? String(n) : String(+n.toFixed(2));
};

export const assignedUnits = (it: Item): number => {
  return Object.values(it.shares).reduce((x, y) => x + y, 0);
};

export const partCount = (it: Item): number => {
  return Object.keys(it.shares).length;
};

export const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fallback below
  }

  try {
    const el = document.createElement('textarea');
    el.value = text;
    el.style.position = 'fixed';
    el.style.opacity = '0';
    document.body.appendChild(el);
    el.focus();
    el.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(el);
    return successful;
  } catch {
    return false;
  }
};

export function buildWhatsAppMessage(
  restaurantName: string,
  paymentMode: 'individual' | 'single',
  singlePayer: Diner | null,
  diners: Diner[],
  tableTotals: TableTotals,
  dinerTotalsMap: Record<number, DinerTotals>,
  collectorAlias: string
): string {
  const mesaGrand = diners.reduce((sum, d) => sum + (dinerTotalsMap[d.id]?.grand || 0), 0);
  let s = `🍽️ *DividiMesa - Resumen*\n📍 ${restaurantName}\n\n`;

  if (paymentMode === 'single' && singlePayer) {
    s += `💳 *${singlePayer.name}* paga todo lo que consumió la mesa: *${money(mesaGrand)}*\n\n📌 *Lo que le transfiere cada uno a ${singlePayer.name}:*\n`;
    diners.forEach(d => {
      const tot = dinerTotalsMap[d.id]?.grand || 0;
      if (d.id === singlePayer.id) {
        s += `• 👑 *${d.name}*: su parte ${money(tot)}\n`;
      } else {
        s += `• 👤 *${d.name}*: ${money(tot)} (${d.paid ? '✅ Pagado' : '⏳ Pendiente'})\n`;
      }
    });
  } else {
    diners.forEach(d => {
      const tot = dinerTotalsMap[d.id]?.grand || 0;
      s += `👤 *${d.name}*: ${money(tot)} (${d.paid ? '✅ Pagado' : '⏳ Pendiente'})\n`;
    });
    s += `\n💰 *Total de la mesa*: ${money(tableTotals.grand)}`;
  }

  const alias = paymentMode === 'single' && singlePayer?.alias ? singlePayer.alias : collectorAlias;
  if (alias) {
    s += `\n\n💳 Alias / CBU: *${alias}*`;
  }

  return s;
}
