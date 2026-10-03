import React, { useState } from 'react';
import { Lock, Mail, User as UserIcon, ArrowRight, ShieldCheck, KeyRound, Loader2, AlertCircle, Sparkles } from 'lucide-react';
import { authService, AuthResponse } from '../../services/auth';

interface LoginScreenProps {
  onSuccess: (authData: AuthResponse) => void;
}

type TabType = 'login' | 'register' | 'recovery';

export const LoginScreen: React.FC<LoginScreenProps> = ({ onSuccess }) => {
  const [tab, setTab] = useState<TabType>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      if (tab === 'login') {
        const res = await authService.login(email, password);
        onSuccess(res);
      } else if (tab === 'register') {
        if (!name.trim()) {
          throw new Error('Por favor ingresá tu nombre');
        }
        const res = await authService.register(name, email, password);
        onSuccess(res);
      } else if (tab === 'recovery') {
        if (!email.trim()) {
          throw new Error('Ingresá tu correo electrónico');
        }
        const res = await authService.forgotPassword(email, password || undefined);
        setSuccessMsg(res.message);
      }
    } catch (err: any) {
      setError(err.message || 'Ocurrió un error inesperado');
    } finally {
      setLoading(false);
    }
  };

  // Quick fill for testing
  const handleQuickFill = (testEmail: string, testPass: string) => {
    setEmail(testEmail);
    setPassword(testPass);
    setError(null);
    setSuccessMsg(null);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-4 selection:bg-emerald-500/30 selection:text-emerald-300">
      {/* Background Glow */}
      <div className="fixed top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10 space-y-6">
        {/* App Title Header */}
        <div className="text-center space-y-1.5">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-slate-950 shadow-lg shadow-emerald-500/20 mb-1">
            <ShieldCheck className="w-6 h-6 stroke-[2.5]" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white">Dividí Mesa</h1>
          <p className="text-xs text-emerald-400 font-semibold">
            La forma fácil de dividir la cuenta entre amigos
          </p>
          <p className="text-[11px] text-slate-400 pt-0.5">
            Ingresá a tu cuenta para acceder a tu mesa
          </p>
        </div>

        {/* Card */}
        <div className="glass-panel rounded-2xl p-6 shadow-2xl border border-slate-800 space-y-5">
          {/* Tabs */}
          <div className="flex bg-slate-900/80 p-1 rounded-xl border border-slate-800 text-xs font-bold">
            <button
              type="button"
              onClick={() => { setTab('login'); setError(null); setSuccessMsg(null); }}
              className={`flex-1 py-2 rounded-lg transition-all cursor-pointer ${
                tab === 'login'
                  ? 'bg-slate-800 text-emerald-400 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Iniciar sesión
            </button>
            <button
              type="button"
              onClick={() => { setTab('register'); setError(null); setSuccessMsg(null); }}
              className={`flex-1 py-2 rounded-lg transition-all cursor-pointer ${
                tab === 'register'
                  ? 'bg-slate-800 text-emerald-400 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Registrarse
            </button>
            <button
              type="button"
              onClick={() => { setTab('recovery'); setError(null); setSuccessMsg(null); }}
              className={`flex-1 py-2 rounded-lg transition-all cursor-pointer ${
                tab === 'recovery'
                  ? 'bg-slate-800 text-emerald-400 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Recuperar
            </button>
          </div>

          {/* Alerts */}
          {error && (
            <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-3 text-xs text-rose-300 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3 text-xs text-emerald-300 flex items-start gap-2">
              <Sparkles className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {tab === 'register' && (
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300">Nombre completo</label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Tu nombre o restaurante"
                    className="w-full bg-slate-900/90 border border-slate-700/80 rounded-xl pl-9 pr-3 py-2.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-300">Correo electrónico</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="ejemplo@correo.com"
                  className="w-full bg-slate-900/90 border border-slate-700/80 rounded-xl pl-9 pr-3 py-2.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-300">
                {tab === 'recovery' ? 'Nueva contraseña (opcional)' : 'Contraseña'}
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                <input
                  type="password"
                  required={tab !== 'recovery'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-900/90 border border-slate-700/80 rounded-xl pl-9 pr-3 py-2.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-black text-xs rounded-xl active:scale-95 transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Verificando...</span>
                </>
              ) : (
                <>
                  <span>
                    {tab === 'login' && 'Entrar a Dividí Mesa'}
                    {tab === 'register' && 'Crear cuenta'}
                    {tab === 'recovery' && 'Restablecer contraseña'}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick Test Accounts for instant verification */}
          <div className="border-t border-slate-800/80 pt-4 space-y-2">
            <p className="text-[11px] font-bold text-slate-400 flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-emerald-400" />
              <span>Cuentas de prueba para diagnóstico:</span>
            </p>
            <div className="grid grid-cols-3 gap-1.5 text-[10px]">
              <button
                type="button"
                onClick={() => handleQuickFill('aiquantumstudio@gmail.com', 'admin123')}
                className="p-2 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-left transition-colors cursor-pointer"
              >
                <div className="font-bold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span>Admin Quantum</span>
                </div>
                <div className="text-[9px] text-slate-400 truncate">aiquantumstudio@...</div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickFill('pendiente@dividimesa.com', 'demo123')}
                className="p-2 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-left transition-colors cursor-pointer"
              >
                <div className="font-bold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                  <span>Pendiente</span>
                </div>
                <div className="text-[9px] text-slate-400 truncate">pendiente@...</div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickFill('revocado@dividimesa.com', 'demo123')}
                className="p-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-left transition-colors cursor-pointer"
              >
                <div className="font-bold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                  <span>Revocado</span>
                </div>
                <div className="text-[9px] text-slate-400 truncate">revocado@...</div>
              </button>
            </div>
          </div>
        </div>

        {/* Security badge footer */}
        <p className="text-[10px] text-slate-400 text-center flex items-center justify-center gap-1">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>Acceso verificado por servidor y licencia de producto</span>
        </p>
      </div>
    </div>
  );
};
