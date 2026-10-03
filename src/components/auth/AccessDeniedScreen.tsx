import React, { useState } from 'react';
import { ShieldX, Clock, Ban, RefreshCw, LogOut, Mail, User as UserIcon } from 'lucide-react';
import { User, UserProduct } from '../../types';

interface AccessDeniedScreenProps {
  user: User;
  license: UserProduct;
  onRefresh: () => Promise<void>;
  onLogout: () => void;
}

export const AccessDeniedScreen: React.FC<AccessDeniedScreenProps> = ({
  user,
  license,
  onRefresh,
  onLogout
}) => {
  const [checking, setChecking] = useState(false);
  const isPending = license.status === 'pending';

  const handleCheckNow = async () => {
    setChecking(true);
    try {
      await onRefresh();
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-4 selection:bg-emerald-500/30 selection:text-emerald-300">
      <div className="fixed top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10 space-y-6">
        {/* Title */}
        <div className="text-center space-y-1.5">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 shadow-xl mb-1">
            {isPending ? <Clock className="w-7 h-7" /> : <Ban className="w-7 h-7 text-rose-400" />}
          </div>
          <h1 className="text-xl font-black tracking-tight text-white">
            {isPending ? 'Activación Pendiente' : 'Acceso Denegado'}
          </h1>
          <p className="text-xs text-amber-400 font-semibold">
            Producto: Dividí Mesa (slug: dividi-mesa)
          </p>
        </div>

        {/* Card */}
        <div className="glass-panel rounded-2xl p-6 shadow-2xl border border-slate-800 space-y-5">
          {/* User badge */}
          <div className="bg-slate-900/90 rounded-xl p-3 border border-slate-800 space-y-1 text-xs">
            <div className="flex items-center justify-between text-slate-300">
              <span className="flex items-center gap-1.5">
                <UserIcon className="w-3.5 h-3.5 text-slate-400" />
                <span className="font-semibold">{user.name}</span>
              </span>
              <span className="font-mono text-[10px] text-slate-400 truncate max-w-[150px]">
                {user.email}
              </span>
            </div>
            <div className="flex items-center justify-between pt-1 border-t border-slate-800/80">
              <span className="text-[11px] text-slate-400">Estado de licencia:</span>
              <span
                className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${
                  isPending
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                }`}
              >
                {license.status}
              </span>
            </div>
          </div>

          {/* Explanation */}
          <div className="text-xs text-slate-300 space-y-2 leading-relaxed bg-slate-900/50 p-3.5 rounded-xl border border-slate-800">
            {isPending ? (
              <>
                <p className="font-bold text-amber-300 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Tu cuenta está registrada con éxito</span>
                </p>
                <p>
                  Para utilizar <strong>Dividí Mesa</strong> se requiere que tu licencia esté en estado <span className="text-emerald-400 font-mono font-bold">active</span>.
                </p>
                <p className="text-[11px] text-slate-400">
                  AI Quantum Studio procesa las solicitudes de compra. Si ya compraste tu acceso o fuiste autorizado, pulsa el botón abajo para verificar en tiempo real.
                </p>
              </>
            ) : (
              <>
                <p className="font-bold text-rose-400 flex items-center gap-1.5">
                  <ShieldX className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>Licencia revocada o suspendida</span>
                </p>
                <p>
                  El acceso a este producto ha sido revocado. Contactate con el administrador para solicitar la reactivación de tu cuenta.
                </p>
              </>
            )}
          </div>

          {/* Actions */}
          <div className="space-y-2 pt-1">
            <button
              type="button"
              disabled={checking}
              onClick={handleCheckNow}
              className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-black text-xs rounded-xl active:scale-95 transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${checking ? 'animate-spin' : ''}`} />
              <span>{checking ? 'Consultando base de datos...' : 'Verificar activación ahora'}</span>
            </button>

            <button
              type="button"
              onClick={onLogout}
              className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700/80 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5 text-slate-400" />
              <span>Cerrar sesión / Cambiar de cuenta</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
