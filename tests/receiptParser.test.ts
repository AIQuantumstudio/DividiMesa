import { parseReceiptText, parsePriceNumber } from '../src/utils/receiptParser';
import { money } from '../src/utils/format';
import { INITIAL_PRESETS } from '../src/data/presets';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exit(1);
  } else {
    console.log(`✅ PASSED: ${message}`);
  }
}

console.log('--- TEST 1: Estado Inicial Limpio Sin Datos Precargados ---');
assert(INITIAL_PRESETS.length === 0, 'INITIAL_PRESETS debe estar completamente vacío (length === 0)');

console.log('\n--- TEST 2: Caso de Prueba Obligatorio de Regresión de Ticket ---');
const regressionTicket = `
MESA: 12 - MOZO: 11
Canti   Unitario     (% IVA)
        Descripcion               Importe
2       SERVICIO DE MESA          4000,00
        Unit: 2000,00   (21,00)
2       AGUA MINERAL              7400,00
        Unit: 3700,00   (21,00)
1       PARRILLITAS PROMO        24900,00
1       ENSALADA DE RÚCULA Y TOMATES 11000,00
2       EMPANADAS DE CARNE        5000,00
        Unit: 2500,00   (21,00)
`;

const parsed = parseReceiptText(regressionTicket);

assert(parsed.length === 5, `Deben reconocerse exactamente 5 productos (se reconocieron ${parsed.length})`);

// 1. SERVICIO DE MESA
const servicio = parsed[0];
assert(servicio.name === 'SERVICIO DE MESA', `Producto 1 nombre esperado 'SERVICIO DE MESA', obtenido '${servicio.name}'`);
assert(servicio.qty === 2, `Producto 1 cantidad esperada 2, obtenida ${servicio.qty}`);
assert(servicio.price === 2000, `Producto 1 precio unitario esperado 2000, obtenido ${servicio.price}`);
assert((servicio.lineTotal ?? servicio.price * servicio.qty) === 4000, `Producto 1 importe de línea esperado 4000, obtenido ${servicio.lineTotal}`);
assert(servicio.currency === 'ARS', `Producto 1 moneda debe ser ARS`);

// 2. AGUA MINERAL
const agua = parsed[1];
assert(agua.name === 'AGUA MINERAL', `Producto 2 nombre esperado 'AGUA MINERAL', obtenido '${agua.name}'`);
assert(agua.qty === 2, `Producto 2 cantidad esperada 2, obtenida ${agua.qty}`);
assert(agua.price === 3700, `Producto 2 precio unitario esperado 3700, obtenido ${agua.price}`);
assert((agua.lineTotal ?? agua.price * agua.qty) === 7400, `Producto 2 importe de línea esperado 7400, obtenido ${agua.lineTotal}`);
assert(agua.currency === 'ARS', `Producto 2 moneda debe ser ARS`);

// Test regla fundamental: asignación individual con precio unitario
const precio1Agua = agua.price * 1;
const precio2Aguas = agua.price * 2;
assert(precio1Agua === 3700, `Asignación de 1 agua debe costar $3.700 (obtenido ${precio1Agua})`);
assert(precio2Aguas === 7400, `Asignación de 2 aguas debe costar $7.400 (obtenido ${precio2Aguas})`);

// 3. PARRILLITAS PROMO
const parrillitas = parsed[2];
assert(parrillitas.name === 'PARRILLITAS PROMO', `Producto 3 nombre esperado 'PARRILLITAS PROMO', obtenido '${parrillitas.name}'`);
assert(parrillitas.qty === 1, `Producto 3 cantidad esperada 1, obtenida ${parrillitas.qty}`);
assert(parrillitas.price === 24900, `Producto 3 precio unitario esperado 24900, obtenido ${parrillitas.price}`);
assert((parrillitas.lineTotal ?? parrillitas.price * parrillitas.qty) === 24900, `Producto 3 importe de línea esperado 24900, obtenido ${parrillitas.lineTotal}`);

// 4. ENSALADA DE RÚCULA Y TOMATES
const ensalada = parsed[3];
assert(ensalada.name === 'ENSALADA DE RÚCULA Y TOMATES', `Producto 4 nombre esperado 'ENSALADA DE RÚCULA Y TOMATES', obtenido '${ensalada.name}'`);
assert(ensalada.qty === 1, `Producto 4 cantidad esperada 1, obtenida ${ensalada.qty}`);
assert(ensalada.price === 11000, `Producto 4 precio unitario esperado 11000, obtenido ${ensalada.price}`);
assert((ensalada.lineTotal ?? ensalada.price * ensalada.qty) === 11000, `Producto 4 importe de línea esperado 11000, obtenido ${ensalada.lineTotal}`);

// 5. EMPANADAS DE CARNE
const empanadas = parsed[4];
assert(empanadas.name === 'EMPANADAS DE CARNE', `Producto 5 nombre esperado 'EMPANADAS DE CARNE', obtenido '${empanadas.name}'`);
assert(empanadas.qty === 2, `Producto 5 cantidad esperada 2, obtenida ${empanadas.qty}`);
assert(empanadas.price === 2500, `Producto 5 precio unitario esperado 2500, obtenido ${empanadas.price}`);
assert((empanadas.lineTotal ?? empanadas.price * empanadas.qty) === 5000, `Producto 5 importe de línea esperado 5000, obtenido ${empanadas.lineTotal}`);

console.log('\n--- TEST 3: Formato de Moneda Argentina (ARS) ---');
assert(money(3700) === '$3.700', `Formato esperado '$3.700', obtenido '${money(3700)}'`);
assert(money(24900) === '$24.900', `Formato esperado '$24.900', obtenido '${money(24900)}'`);

console.log('\n🎉 TODOS LOS TESTS DE REGRESIÓN Y LIMPIEZA PASARON CON ÉXITO.');
