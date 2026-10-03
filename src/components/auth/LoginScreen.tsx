import React, { useState } from 'react';
import {
  Lock,
  Mail,
  User as UserIcon,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  Loader2,
  AlertCircle,
  PlayCircle,
  Eye,
  EyeOff,
  CheckCircle2,
  KeyRound,
  ChevronDown,
  ChevronUp,
  RefreshCw
} from 'lucide-react';
import { authService, AuthResponse } from '../../services/auth';

interface LoginScreenProps {
  onSuccess: (authData: AuthResponse) => void;
}

type TabType = 'login' | 'register' | 'recovery';

export const LoginScreen: React.FC<LoginScreenProps> = ({ onSuccess }) => {
  const [tab, setTab] = useState<TabType>('login');
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Recovery flow states
  const [recoveryStep, setRecoveryStep] = useState<1 | 2>(1);
  const [recoveryVerifiedEmail, setRecoveryVerifiedEmail] = useState<string>('');

  // Diagnostic collapsible panel (hidden by default for clean public launch)
  const [showDiagnostics, setShowDiagnostics] = useState(false);

  // 1. One-Click Demo Mode (NO credentials shown or required)
  const handleDemoAccess = async () => {
    setError(null);
    setSuccessMsg(null);
    setDemoLoading(true);
    try {
      const res = await authService.loginDemo();
      onSuccess(res);
    } catch (err: any) {
      setError(err.message || 'No fue posible iniciar la sesión de demostración');
    } finally {
      setDemoLoading(false);
    }
  };

  // Switch Tab Handler
  const handleTabChange = (newTab: TabType) => {
    setTab(newTab);
    setError(null);
    setSuccessMsg(null);
    setPassword('');
    setConfirmPassword('');
    if (newTab === 'recovery') {
      setRecoveryStep(1);
      setRecoveryVerifiedEmail('');
    }
  };

  // Form Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const cleanEmail = email.trim().toLowerCase();

    // Validations
    if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setError('Por favor ingresá un correo electrónico válido');
      return;
    }

    if (tab === 'register') {
      if (!name.trim()) {
        setError('Por favor ingresá tu nombre o el de tu restaurante');
        return;
      }
      if (password.length < 4) {
        setError('La contraseña debe tener al menos 4 caracteres');
        return;
      }
      if (password !== confirmPassword) {
        setError('Las contraseñas no coinciden. Verificalas.');
        return;
      }
    }

    if (tab === 'login') {
      if (!password) {
        setError('Ingresá tu contraseña para continuar');
        return;
      }
    }

    if (tab === 'recovery' && recoveryStep === 2) {
      if (password.length < 4) {
        setError('La nueva contraseña debe tener al menos 4 caracteres');
        return;
      }
      if (password !== confirmPassword) {
        setError('Las contraseñas no coinciden');
        return;
      }
    }

    setLoading(true);

    try {
      if (tab === 'login') {
        const res = await authService.login(cleanEmail, password);
        onSuccess(res);
      } else if (tab === 'register') {
        const res = await authService.register(name.trim(), cleanEmail, password);
        onSuccess(res);
      } else if (tab === 'recovery') {
        if (recoveryStep === 1) {
          // Verify email existence
          const checkRes = await authService.forgotPassword(cleanEmail);
          setRecoveryVerifiedEmail(cleanEmail);
          setRecoveryStep(2);
          setSuccessMsg(checkRes.message || 'Cuenta validada. Ingresá tu nueva contraseña.');
        } else {
          // Set new password
          const resetRes = await authService.forgotPassword(recoveryVerifiedEmail, password);
          setSuccessMsg(resetRes.message || '¡Contraseña restablecida exitosamente!');
          // Smooth transition to login with email prefilled
          setTimeout(() => {
            setEmail(recoveryVerifiedEmail);
            setPassword('');
            setConfirmPassword('');
            setTab('login');
            setRecoveryStep(1);
          }, 1800);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Error en la solicitud. Intentalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  // Quick fill helper for diagnostics
  const handleQuickFill = (testEmail: string, testPass: string) => {
    setTab('login');
    setEmail(testEmail);
    setPassword(testPass);
    setError(null);
    setSuccessMsg(null);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-4 selection:bg-emerald-500/30 selection:text-emerald-300">
      {/* Background Ambient Glow */}
      <div className="fixed top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10 space-y-4">
        {/* App Title & Identity Header */}
        <div className="text-center space-y-1">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-slate-950 shadow-lg shadow-emerald-500/20 mb-1">
            <ShieldCheck className="w-6 h-6 stroke-[2.5]" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white">Dividí Mesa</h1>
          <p className="text-xs text-emerald-400 font-semibold">
            La forma fácil de dividir la cuenta entre amigos
          </p>
          <p className="text-[11px] text-slate-400">
            Plataforma Comercial • AI Quantum Studio
          </p>
        </div>

        {/* PROBAR DEMOSTRACIÓN (AI QUANTUM STUDIO) - ONE-CLICK ACCESSIBLE */}
        <div className="glass-panel rounded-2xl p-4 border border-emerald-500/30 shadow-xl bg-gradient-to-b from-emerald-950/20 to-slate-900/40 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-slate-200 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <span>¿Querés probar Dividí Mesa ahora?</span>
            </span>
            <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full font-bold border border-emerald-500/30">
              ACCESO LIBRE
            </span>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Ingresá a la demostración interactiva con todas las funciones activas (sin registro ni contraseñas requeridas).
          </p>
          <button
            type="button"
            disabled={demoLoading}
            onClick={handleDemoAccess}
            className="w-full py-3 bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-black text-xs rounded-xl active:scale-95 transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {demoLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                <span>Cargando demostración...</span>
              </>
            ) : (
              <>
                <PlayCircle className="w-4 h-4" />
                <span>PROBAR DEMOSTRACIÓN</span>
              </>
            )}
          </button>
        </div>

        {/* Main Card (Login, Register & Password Recovery) */}
        <div className="glass-panel rounded-2xl p-5 shadow-2xl border border-slate-800 space-y-4">
          {/* Tab Navigation */}
          <div className="flex bg-slate-900/90 p-1 rounded-xl border border-slate-800 text-xs font-bold">
            <button
              type="button"
              onClick={() => handleTabChange('login')}
              className={`flex-1 py-1.5 rounded-lg transition-all cursor-pointer ${
                tab === 'login'
                  ? 'bg-slate-800 text-emerald-400 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Iniciar sesión
            </button>
            <button
              type="button"
              onClick={() => handleTabChange('register')}
              className={`flex-1 py-1.5 rounded-lg transition-all cursor-pointer ${
                tab === 'register'
                  ? 'bg-slate-800 text-emerald-400 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Crear cuenta
            </button>
            <button
              type="button"
              onClick={() => handleTabChange('recovery')}
              className={`flex-1 py-1.5 rounded-lg transition-all cursor-pointer ${
                tab === 'recovery'
                  ? 'bg-slate-800 text-emerald-400 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Recuperar
            </button>
          </div>

          {/* Feedback Messages */}
          {error && (
            <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-3 text-xs text-rose-300 flex items-start gap-2 animate-in fade-in duration-200">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3 text-xs text-emerald-300 flex items-start gap-2 animate-in fade-in duration-200">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Interactive Form */}
          <form onSubmit={handleSubmit} className="space-y-3.5">
            {/* REGISTER: Name input */}
            {tab === 'register' && (
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300">Nombre completo o Restaurante</label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Ej. Juan Pérez / Don Julio"
                    autoComplete="name"
                    className="w-full bg-slate-900/90 border border-slate-700/80 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>
              </div>
            )}

            {/* EMAIL INPUT (Disabled on Step 2 of Recovery) */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-300">Correo electrónico</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                <input
                  type="email"
                  required
                  disabled={tab === 'recovery' && recoveryStep === 2}
                  value={tab === 'recovery' && recoveryStep === 2 ? recoveryVerifiedEmail : email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="ejemplo@correo.com"
                  autoComplete="email"
                  inputMode="email"
                  className={`w-full bg-slate-900/90 border rounded-xl pl-9 pr-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none transition-colors ${
                    tab === 'recovery' && recoveryStep === 2
                      ? 'border-emerald-500/50 bg-emerald-950/20 text-emerald-300 opacity-90'
                      : 'border-slate-700/80 focus:border-emerald-500'
                  }`}
                />
              </div>
            </div>

            {/* PASSWORD INPUT (Hidden on Step 1 of Recovery) */}
            {(tab !== 'recovery' || recoveryStep === 2) && (
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-slate-300">
                    {tab === 'recovery' ? 'Nueva contraseña' : 'Contraseña'}
                  </label>
                  {tab === 'login' && (
                    <button
                      type="button"
                      onClick={() => handleTabChange('recovery')}
                      className="text-[11px] text-emerald-400 hover:text-emerald-300 transition-colors cursor-pointer"
                    >
                      ¿Olvidaste tu contraseña?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder={tab === 'recovery' ? 'Mínimo 4 caracteres' : '••••••••'}
                    autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
                    className="w-full bg-slate-900/90 border border-slate-700/80 rounded-xl pl-9 pr-10 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-200 cursor-pointer"
                    title={showPassword ? 'Ocultar' : 'Mostrar'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}

            {/* CONFIRM PASSWORD INPUT (Only on Register & Recovery Step 2) */}
            {(tab === 'register' || (tab === 'recovery' && recoveryStep === 2)) && (
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300">Confirmar contraseña</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="Repetí la contraseña"
                    autoComplete="new-password"
                    className="w-full bg-slate-900/90 border border-slate-700/80 rounded-xl pl-9 pr-10 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-200 cursor-pointer"
                    title={showConfirmPassword ? 'Ocultar' : 'Mostrar'}
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}

            {/* ACTION SUBMIT BUTTON */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-100 font-bold text-xs rounded-xl active:scale-95 transition-all border border-slate-700 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-2 shadow-sm"
            >
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Procesando...</span>
                </>
              ) : (
                <>
                  <span>
                    {tab === 'login' && 'Ingresar a mi cuenta'}
                    {tab === 'register' && 'Crear cuenta y solicitar acceso'}
                    {tab === 'recovery' && recoveryStep === 1 && 'Validar correo'}
                    {tab === 'recovery' && recoveryStep === 2 && 'Guardar nueva contraseña'}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>

            {/* Recovery Step 2: Option to reset and try another email */}
            {tab === 'recovery' && recoveryStep === 2 && (
              <button
                type="button"
                onClick={() => {
                  setRecoveryStep(1);
                  setRecoveryVerifiedEmail('');
                  setPassword('');
                  setConfirmPassword('');
                  setError(null);
                  setSuccessMsg(null);
                }}
                className="w-full text-center text-[11px] text-slate-400 hover:text-slate-200 py-1 transition-colors cursor-pointer flex items-center justify-center gap-1"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Usar otro correo</span>
              </button>
            )}
          </form>

          {/* Sub-links for friendly flow */}
          <div className="pt-2 border-t border-slate-800/80 text-center text-xs text-slate-400">
            {tab === 'login' && (
              <span>
                ¿Todavía no tenés cuenta?{' '}
                <button
                  type="button"
                  onClick={() => handleTabChange('register')}
                  className="text-emerald-400 font-bold hover:underline cursor-pointer"
                >
                  Registrate acá
                </button>
              </span>
            )}
            {tab === 'register' && (
              <span>
                ¿Ya tenés cuenta?{' '}
                <button
                  type="button"
                  onClick={() => handleTabChange('login')}
                  className="text-emerald-400 font-bold hover:underline cursor-pointer"
                >
                  Iniciá sesión
                </button>
              </span>
            )}
            {tab === 'recovery' && (
              <span>
                ¿Recordaste tu clave?{' '}
                <button
                  type="button"
                  onClick={() => handleTabChange('login')}
                  className="text-emerald-400 font-bold hover:underline cursor-pointer"
                >
                  Volver al inicio de sesión
                </button>
              </span>
            )}
          </div>
        </div>

        {/* Collapsible Diagnostic & Testing Panel (Cleanly hidden for production release) */}
        <div className="glass-panel rounded-2xl p-3 border border-slate-800/80">
          <button
            type="button"
            onClick={() => setShowDiagnostics(!showDiagnostics)}
            className="w-full flex items-center justify-between text-[11px] text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-1.5 font-semibold">
              <KeyRound className="w-3.5 h-3.5 text-emerald-400" />
              <span>Accesos rápidos de prueba (Diagnóstico interno)</span>
            </div>
            {showDiagnostics ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {showDiagnostics && (
            <div className="mt-2.5 pt-2.5 border-t border-slate-800/80 space-y-1.5">
              <p className="text-[10px] text-slate-500">
                Seleccioná cualquiera de las cuentas precargadas para probar el comportamiento en tiempo real:
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-[10px]">
                {/* 1. Admin */}
                <button
                  type="button"
                  onClick={() => handleQuickFill('aiquantumstudio@gmail.com', 'admin123')}
                  className="p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-left transition-colors cursor-pointer"
                  title="Administrador Principal (aiquantumstudio@gmail.com)"
                >
                  <div className="font-bold flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-emerald-400" />
                    <span>Admin</span>
                  </div>
                  <div className="text-[9px] text-slate-400 truncate">aiquantumstudio</div>
                </button>

                {/* 2. Activo */}
                <button
                  type="button"
                  onClick={() => handleQuickFill('cliente.activo@ejemplo.com', 'demo123')}
                  className="p-1.5 rounded-lg bg-teal-500/10 hover:bg-teal-500/20 text-teal-300 border border-teal-500/30 text-left transition-colors cursor-pointer"
                  title="Cliente Autorizado"
                >
                  <div className="font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-teal-400" />
                    <span>Activo</span>
                  </div>
                  <div className="text-[9px] text-slate-400 truncate">cliente.activo@...</div>
                </button>

                {/* 3. Pendiente */}
                <button
                  type="button"
                  onClick={() => handleQuickFill('cliente.pendiente@ejemplo.com', 'demo123')}
                  className="p-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-left transition-colors cursor-pointer"
                  title="Cliente Pendiente"
                >
                  <div className="font-bold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                    <span>Pendiente</span>
                  </div>
                  <div className="text-[9px] text-slate-400 truncate">cliente.pendiente@...</div>
                </button>

                {/* 4. Revocado */}
                <button
                  type="button"
                  onClick={() => handleQuickFill('cliente.revocado@ejemplo.com', 'demo123')}
                  className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-left transition-colors cursor-pointer"
                  title="Cliente Revocado"
                >
                  <div className="font-bold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                    <span>Revocado</span>
                  </div>
                  <div className="text-[9px] text-slate-400 truncate">cliente.revocado@...</div>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <p className="text-[10px] text-slate-500 text-center flex items-center justify-center gap-1">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400/80" />
          <span>Infraestructura segura sin costos adicionales • AI Quantum Studio</span>
        </p>
      </div>
    </div>
  );
};
