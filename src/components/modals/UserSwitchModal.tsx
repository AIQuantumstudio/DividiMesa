import React from 'react';
import { X, UserCheck, Plus } from 'lucide-react';
import { Diner, COLORS } from '../../types';

interface UserSwitchModalProps {
  isOpen: boolean;
  diners: Diner[];
  currentDinerId: number | null;
  onClose: () => void;
  onSelectDiner: (id: number) => void;
  onOpenAddDiner: () => void;
}

export const UserSwitchModal: React.FC<UserSwitchModalProps> = ({
  isOpen,
  diners,
  currentDinerId,
  onClose,
  onSelectDiner,
  onOpenAddDiner
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="glass-panel w-full max-w-sm rounded-2xl p-5 space-y-4 shadow-2xl border border-slate-700/60">
        <div className="flex justify-between items-center border-b border-slate-800 pb-2">
          <h3 className="font-bold text-sm text-slate-100 flex items-center gap-1.5">
            <UserCheck className="w-4 h-4 text-emerald-400" />
            <span>Cambiar comensal activo</span>
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 cursor-pointer p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
          {diners.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-3">No hay comensales aún.</p>
          ) : (
            diners.map(d => {
              const c = COLORS[d.color];
              const isAct = d.id === currentDinerId;

              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => {
                    onSelectDiner(d.id);
                    onClose();
                  }}
                  className={`w-full flex items-center justify-between p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    isAct
                      ? `${c.bg} ${c.border} shadow-md`
                      : 'bg-slate-900/60 hover:bg-slate-900 border-slate-800'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <div
                      className={`w-8 h-8 rounded-full ${c.badge} flex items-center justify-center font-black text-xs shadow-sm`}
                    >
                      {d.avatar}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-100">{d.name}</div>
                      <div className="text-[10px] text-slate-400">
                        {d.paid ? '✅ Pagado' : '⏳ Pendiente'}
                      </div>
                    </div>
                  </div>

                  {isAct && (
                    <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                      Activo
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>

        <button
          type="button"
          onClick={() => {
            onClose();
            onOpenAddDiner();
          }}
          className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-emerald-400 hover:text-emerald-300 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Agregar comensal</span>
        </button>
      </div>
    </div>
  );
};
