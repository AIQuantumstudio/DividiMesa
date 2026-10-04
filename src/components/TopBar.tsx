import React from 'react';
import { RotateCcw, QrCode, Camera } from 'lucide-react';

interface TopBarProps {
  dinersCount: number;
  onReset: () => void;
  onOpenQr: () => void;
  onOpenScanner: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  dinersCount,
  onReset,
  onOpenQr,
  onOpenScanner
}) => {
  return (
    <div className="glass-panel rounded-2xl p-3 flex items-center justify-between text-xs shadow-md">
      <div className="flex items-center space-x-2">
        <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shadow-sm shadow-emerald-400"></div>
        <span className="text-slate-300 font-medium">
          {dinersCount} {dinersCount === 1 ? 'comensal' : 'comensales'}
        </span>
      </div>
      <div className="flex space-x-1.5">
        <button
          type="button"
          onClick={onReset}
          className="text-[11px] bg-rose-500/15 text-rose-300 hover:bg-rose-500/25 px-2 py-1.5 rounded-lg border border-rose-500/30 active:scale-95 transition-all flex items-center gap-1 cursor-pointer"
        >
          <RotateCcw className="w-3 h-3 text-rose-400" />
          <span>Reiniciar</span>
        </button>
        <button
          type="button"
          onClick={onOpenQr}
          className="text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-200 px-2 py-1.5 rounded-lg border border-slate-700 active:scale-95 transition-all flex items-center gap-1 cursor-pointer"
        >
          <QrCode className="w-3 h-3 text-emerald-400" />
          <span>QR</span>
        </button>
        <button
          type="button"
          onClick={onOpenScanner}
          className="text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-200 px-2.5 py-1.5 rounded-lg border border-slate-700 active:scale-95 transition-all flex items-center gap-1 cursor-pointer"
          title="Escanear ticket"
        >
          <Camera className="w-3 h-3 text-emerald-400" />
          <span>Escanear ticket</span>
        </button>
      </div>
    </div>
  );
};
