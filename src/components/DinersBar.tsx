import React from 'react';
import { Plus, UserPlus, X, CheckCircle2 } from 'lucide-react';
import { Diner, COLORS } from '../types';

interface DinersBarProps {
  diners: Diner[];
  currentDinerId: number | null;
  onSelectDiner: (id: number) => void;
  onAddDiner: () => void;
  onDeleteDiner: (id: number) => void;
}

export const DinersBar: React.FC<DinersBarProps> = ({
  diners,
  currentDinerId,
  onSelectDiner,
  onAddDiner,
  onDeleteDiner
}) => {
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center px-1">
        <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
          ¿Quién sos vos?
        </label>
        <button
          type="button"
          onClick={onAddDiner}
          className="text-xs text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1 active:scale-95 transition-all cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Agregar comensal</span>
        </button>
      </div>

      <div className="flex space-x-2 overflow-x-auto pb-1 pt-1 no-scrollbar items-center">
        {diners.length === 0 ? (
          <div
            onClick={onAddDiner}
            className="cursor-pointer border-2 border-dashed border-slate-700 hover:border-emerald-500/50 hover:bg-slate-900/60 rounded-xl px-4 py-2 text-xs font-bold text-slate-400 hover:text-slate-200 whitespace-nowrap transition-all flex items-center gap-2"
          >
            <UserPlus className="w-3.5 h-3.5 text-emerald-400" />
            <span>Tocá para registrarte</span>
          </div>
        ) : (
          diners.map(d => {
            const color = COLORS[d.color];
            const isActive = d.id === currentDinerId;

            return (
              <div
                key={d.id}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all shrink-0 ${
                  isActive
                    ? `${color.bg} ${color.border} text-white ring-1 ring-emerald-400/50 shadow-md`
                    : 'bg-slate-900/80 hover:bg-slate-900 border-slate-800 text-slate-300'
                }`}
              >
                <div
                  onClick={() => onSelectDiner(d.id)}
                  className="flex items-center space-x-2 cursor-pointer select-none"
                >
                  <span
                    className={`w-5 h-5 rounded-full ${color.badge} flex items-center justify-center text-[10px] font-black`}
                  >
                    {d.avatar}
                  </span>
                  <span>{d.name}</span>
                  {d.paid && (
                    <CheckCircle2 className="w-3 h-3 text-emerald-400 inline" />
                  )}
                </div>
                <button
                  type="button"
                  onClick={e => {
                    e.stopPropagation();
                    onDeleteDiner(d.id);
                  }}
                  className="ml-1 text-slate-400 hover:text-rose-400 p-0.5 rounded cursor-pointer transition-colors"
                  title={`Eliminar a ${d.name}`}
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
