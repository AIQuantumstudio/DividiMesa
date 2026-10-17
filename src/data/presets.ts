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

export const INITIAL_PRESETS: Preset[] = [];
