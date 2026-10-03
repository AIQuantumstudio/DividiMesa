import { Preset, Item, ItemMode } from '../types';

const defMode = (qty: number): ItemMode => (qty > 1 ? 'units' : 'shared');

const mk = (id: number, name: string, price: number, qty = 1): Item => ({
  id,
  name,
  price,
  qty,
  mode: defMode(qty),
  shares: {}
});

export const INITIAL_PRESETS: Preset[] = [
  {
    key: 'asado',
    title: '🥩 Parrilla Tradicional',
    restaurant: 'Don Julio Parrilla - Mesa 12',
    items: [
      mk(101, 'Ojo de Bife Acompañado', 18500),
      mk(102, 'Empanada de Carne', 1700, 6),
      mk(103, 'Ensalada Rúcula & Parmesano', 7200),
      mk(104, 'Vino Rutini Malbec 750ml', 16000),
      mk(105, 'Burger Doble Queso', 11000),
      mk(106, 'Pasta Rib eye Ragú', 13500),
      mk(107, 'Volcán de Chocolate con Helado', 4800),
      mk(108, 'Coca-Cola 1.5L (para la mesa)', 4200)
    ]
  },
  {
    key: 'pizzeria',
    title: '🍕 Pizza & Cerveza',
    restaurant: 'Pizzería Guerrin - Mesa 05',
    items: [
      mk(201, 'Pizza Grande Muzzarella con Fainá', 14000),
      mk(202, 'Pizza Fugazzeta Rellena', 16500),
      mk(203, 'Cerveza Imperial 1L', 4000, 2),
      mk(204, 'Flan Mixto Dulce de Leche', 3500)
    ]
  },
  {
    key: 'sushi',
    title: '🍣 Sushi Nikkei',
    restaurant: 'Osaka Nikkei - Mesa 02',
    items: [
      mk(301, 'Tabla Omakase 40 piezas', 42000),
      mk(302, 'Pisco Sour', 4500, 3),
      mk(303, 'Ceviche Clásico Pesca del Día', 16000),
      mk(304, 'Tiramisú Matcha', 6500)
    ]
  },
  {
    key: 'cafeteria',
    title: '☕ Brunch & Café',
    restaurant: 'Café de Especialidad - Mesa 08',
    items: [
      mk(401, 'Avocado Toast con Huevo Poché', 6800),
      mk(402, 'Flat White Doble', 3200, 2),
      mk(403, 'Croissant Relleno Pistacho', 4100),
      mk(404, 'Yogur Granola & Frutos Rojos', 5200)
    ]
  }
];
