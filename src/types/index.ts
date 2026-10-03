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

export type LicenseStatus = 'pending' | 'active' | 'revoked';

export interface User {
  id: string;
  name: string;
  email: string;
  created_at: string;
  status: 'active' | 'pending' | 'suspended';
}

export interface Product {
  id: string;
  name: string;
  slug: string;
}

export interface UserProduct {
  id: string;
  user_id: string;
  product_id: string;
  status: LicenseStatus;
  activated_at: string | null;
}

export interface AuthSession {
  user: User;
  license: UserProduct;
  product: Product;
  token: string;
}

export interface AdminNotification {
  id: string;
  type: 'USER_REGISTERED' | 'LOGIN_ATTEMPT_PENDING' | 'LOGIN_ATTEMPT_REVOKED';
  user_name: string;
  user_email: string;
  product_name: string;
  product_slug: string;
  status: 'pending' | 'revoked';
  recipient: string;
  created_at: string;
  read: boolean;
  subject: string;
  body: string;
}


