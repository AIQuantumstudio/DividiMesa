import React from 'react';
import { RotateCcw, Camera } from 'lucide-react';

interface TopBarProps {
  dinersCount: number;
  itemsCount: number;
  onNewTable: () => void;
  onOpenScanner: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  dinersCount,
  itemsCount,
  onNewTable,
  onOpenScanner
}) => {
  const isTableEmpty = dinersCount === 0 && itemsCount === 0;

  return (
    <div className="glass-panel rounded-2xl p-2.5 sm:p-3 flex items-center justify-between text-xs shadow-md">
      <div className="flex items-center space-x-2">
        <div
          className={`w-2.5 h-2.5 rounded-full ${
            !isTableEmpty ? 'bg-emerald-400 animate-pulse shadow-sm shadow-emerald-400' : 'bg-slate-600'
          }`}
        />
        <span className="text-slate-300 font-medium text-xs">
          {isTableEmpty
            ? 'Mesa vacía'
            : `${dinersCount} ${dinersCount === 1 ? 'comensal' : 'comensales'} • ${itemsCount} ${itemsCount === 1 ? 'ítem' : 'ítems'}`}
        </span>
      </div>
      <div className="flex space-x-1.5">
        <button
          type="button"
          onClick={onNewTable}
          className="text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-rose-300 px-2.5 py-1.5 rounded-lg border border-slate-700 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
          title="Iniciar una nueva cuenta o mesa desde cero"
        >
          <RotateCcw className="w-3.5 h-3.5 text-rose-400" />
          <span className="font-bold">Nueva mesa</span>
        </button>
        <button
          type="button"
          onClick={onOpenScanner}
          className="text-[11px] bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-black px-2.5 py-1.5 rounded-lg active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
          title="Escanear ticket"
        >
          <Camera className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>Escanear ticket</span>
        </button>
      </div>
    </div>
  );
};
