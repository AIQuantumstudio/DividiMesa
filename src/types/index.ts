export type ColorKey = 'emerald' | 'sky' | 'amber' | 'purple' | 'rose';

export interface ColorTheme {
  bg: string;
  border: string;
  badge: string;
  ring: string;
}

export const COLORS: Record<ColorKey, ColorTheme> = {
  emerald: {
    bg: 'bg-emerald-500/20',
    border: 'border-emerald-500/40',
    badge: 'bg-emerald-500 text-slate-950',
    ring: 'ring-emerald-400/50'
  },
  sky: {
    bg: 'bg-sky-500/20',
    border: 'border-sky-500/40',
    badge: 'bg-sky-500 text-slate-950',
    ring: 'ring-sky-400/50'
  },
  amber: {
    bg: 'bg-amber-500/20',
    border: 'border-amber-500/40',
    badge: 'bg-amber-500 text-slate-950',
    ring: 'ring-amber-400/50'
  },
  purple: {
    bg: 'bg-purple-500/20',
    border: 'border-purple-500/40',
    badge: 'bg-purple-500 text-slate-950',
    ring: 'ring-purple-400/50'
  },
  rose: {
    bg: 'bg-rose-500/20',
    border: 'border-rose-500/40',
    badge: 'bg-rose-500 text-slate-950',
    ring: 'ring-rose-400/50'
  }
};

export type ItemMode = 'units' | 'shared';

export interface Diner {
  id: number;
  name: string;
  color: ColorKey;
  avatar: string;
  paid: boolean;
  alias?: string;
}

export interface Item {
  id: number;
  name: string;
  price: number;
  qty: number;
  mode: ItemMode;
  shares: Record<number, number>; // dinerId -> quantity consumed or 1 for shared
}

export interface Preset {
  key: string;
  title: string;
  restaurant: string;
  items: Item[];
}

export type PaymentMode = 'individual' | 'single';

export interface TableTotals {
  sub: number;
  tip: number;
  cover: number;
  grand: number;
  un: number; // unassigned items count
}

export interface DinerTotals {
  sub: number;
  tip: number;
  cover: number;
  grand: number;
}
