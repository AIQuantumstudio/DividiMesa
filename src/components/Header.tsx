import React from 'react';
import { Receipt, Utensils, QrCode, Lock, Unlock, ShieldAlert } from 'lucide-react';
import { Diner, COLORS } from '../types';

interface HeaderProps {
  isAdminMode: boolean;
  restaurantName: string;
  currentDiner: Diner | null;
  onToggleMode: () => void;
  onOpenUserModal: () => void;
  onOpenQr: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  isAdminMode,
  restaurantName,
  currentDiner,
  onToggleMode,
  onOpenUserModal,
  onOpenQr
}) => {
  const activeColor = currentDiner ? COLORS[currentDiner.color] : null;

  return (
    <header className="sticky top-0 z-30 glass-panel border-b border-slate-800 px-4 py-3 shadow-xl">
      <div className="max-w-md md:max-w-2xl mx-auto flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-slate-950 text-xl shadow-md shadow-emerald-500/10">
            <Receipt className="w-5 h-5 stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="font-extrabold text-lg leading-none text-white tracking-tight">DividiMesa</h1>
              {!isAdminMode ? (
                <span className="bg-emerald-500/20 text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-500/30">
                  COMENSAL
                </span>
              ) : (
                <span className="bg-amber-500/20 text-amber-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-500/30 flex items-center gap-1">
                  <ShieldAlert className="w-3 h-3 text-amber-400 inline" /> RESTAURANTE
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
              <Utensils className="w-3 h-3 text-emerald-400 shrink-0" />
              <span className="truncate max-w-[170px] sm:max-w-[260px]">{restaurantName}</span>
              <button
                type="button"
                onClick={onOpenQr}
                className="ml-1 text-slate-400 hover:text-emerald-400 transition-colors p-0.5"
                title="Ver QR de la mesa"
              >
                <QrCode className="w-3.5 h-3.5 inline" />
              </button>
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-1.5">
          <button
            type="button"
            onClick={onToggleMode}
            className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-2.5 py-1.5 rounded-xl border border-slate-700 text-xs font-bold active:scale-95 flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
          >
            {isAdminMode ? (
              <>
                <Unlock className="w-3.5 h-3.5 text-amber-400" />
                <span>Comensal</span>
              </>
            ) : (
              <>
                <Lock className="w-3.5 h-3.5 text-amber-400" />
                <span>Restaurante</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onOpenUserModal}
            className="flex items-center space-x-2 bg-slate-800/80 hover:bg-slate-800 px-2.5 py-1.5 rounded-xl border border-slate-700 active:scale-95 transition-all shadow-sm cursor-pointer"
          >
            <div
              className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[11px] ${
                activeColor ? activeColor.badge : 'bg-slate-700 text-slate-400'
              }`}
            >
              {currentDiner ? currentDiner.avatar : '?'}
            </div>
            <span className="text-xs font-semibold max-w-[65px] truncate">
              {currentDiner ? currentDiner.name : 'Sin user'}
            </span>
          </button>
        </div>
      </div>
    </header>
  );
};
