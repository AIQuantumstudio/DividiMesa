import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  X,
  RefreshCw,
  CheckCircle2,
  Clock,
  Ban,
  User as UserIcon,
  Bell,
  Mail,
  Check,
  AlertTriangle
} from 'lucide-react';
import { authService } from '../../services/auth';
import { AdminNotification } from '../../types';

interface AdminLicenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onToast: (msg: string) => void;
}

export const AdminLicenseModal: React.FC<AdminLicenseModalProps> = ({
  isOpen,
  onClose,
  onToast
}) => {
  const [activeTab, setActiveTab] = useState<'users' | 'notifications'>('users');
  const [users, setUsers] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [usersData, notifsData] = await Promise.all([
        authService.getAdminUsers(),
        authService.getAdminNotifications()
      ]);
      setUsers(usersData.users || []);
      setNotifications(notifsData.notifications || []);
    } catch (err: any) {
      onToast(err.message || 'Error cargando datos administrativos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchData();
    }
  }, [isOpen]);

  const handleStatusChange = async (userId: string, newStatus: 'pending' | 'active' | 'revoked') => {
    setUpdatingId(userId);
    try {
      await authService.updateLicense(userId, newStatus);
      onToast(`Licencia actualizada a: ${newStatus.toUpperCase()}`);
      setUsers(prev =>
        prev.map(u => (u.id === userId ? { ...u, licenseStatus: newStatus } : u))
      );
    } catch (err: any) {
      onToast(err.message || 'Error actualizando licencia');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleMarkAsRead = async (notifId: string) => {
    try {
      await authService.markNotificationRead(notifId);
      setNotifications(prev =>
        prev.map(n => (n.id === notifId ? { ...n, read: true } : n))
      );
    } catch {
      // ignore
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4">
      <div className="glass-panel w-full max-w-xl rounded-2xl p-5 space-y-4 shadow-2xl border border-slate-700/80 max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center border-b border-slate-800 pb-2 shrink-0">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-100">Control Administrativo (AI Quantum Studio)</h3>
              <p className="text-[10px] text-slate-400">
                Destinatario de avisos: <span className="text-emerald-400 font-mono">aiquantumstudio@gmail.com</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 cursor-pointer p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-slate-900/90 p-1 rounded-xl border border-slate-800 text-xs font-bold shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('users')}
            className={`flex-1 py-1.5 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'users'
                ? 'bg-slate-800 text-emerald-400 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <UserIcon className="w-3.5 h-3.5" />
            <span>Clientes y Licencias ({users.filter(u => !u.is_demo && u.role !== 'admin').length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('notifications')}
            className={`flex-1 py-1.5 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'notifications'
                ? 'bg-slate-800 text-emerald-400 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Bell className="w-3.5 h-3.5" />
            <span>Notificaciones ({notifications.length})</span>
            {unreadCount > 0 && (
              <span className="bg-amber-500 text-slate-950 font-black text-[9px] px-1.5 py-0.2 rounded-full">
                {unreadCount}
              </span>
            )}
          </button>
        </div>

        {/* Top Info Bar */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-300 leading-relaxed shrink-0 flex items-center justify-between">
          <span className="text-[11px]">
            {activeTab === 'users'
              ? 'Habilitá o revocá permisos para Dividí Mesa con 1 clic:'
              : 'Alertas despachadas a aiquantumstudio@gmail.com (con protección anti-spam):'}
          </span>
          <button
            type="button"
            onClick={fetchData}
            disabled={loading}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 cursor-pointer"
            title="Recargar"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* TAB 1: USERS LIST */}
        {activeTab === 'users' && (
          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {loading && users.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">Cargando base de datos...</div>
            ) : (
              users.map(u => {
                const isUpdating = updatingId === u.id;
                const status = u.licenseStatus;

                return (
                  <div
                    key={u.id}
                    className="bg-slate-900/90 border border-slate-800/90 rounded-xl p-3 space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <div className="font-bold text-slate-200 flex items-center gap-1.5">
                          <UserIcon className="w-3.5 h-3.5 text-slate-400" />
                          <span>{u.name}</span>
                        </div>
                        <div className="font-mono text-[11px] text-slate-400">{u.email}</div>
                      </div>

                      <span
                        className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${
                          status === 'active'
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                            : status === 'pending'
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                            : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                        }`}
                      >
                        {status}
                      </span>
                    </div>

                    {/* Actions buttons */}
                    {u.is_demo ? (
                      <div className="pt-1.5 border-t border-slate-800 text-[10px] text-emerald-400/90 flex items-center justify-between">
                        <span>✨ Cuenta DEMO de exhibición (No es compra de cliente)</span>
                        <span className="font-semibold text-slate-500 text-[9px]">Protegida</span>
                      </div>
                    ) : u.role === 'admin' ? (
                      <div className="pt-1.5 border-t border-slate-800 text-[10px] text-emerald-400 flex items-center justify-between">
                        <span>👑 Administrador Principal del Sistema</span>
                        <span className="font-semibold text-emerald-500/80 text-[9px]">Acceso total</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 pt-1 border-t border-slate-800">
                        <span className="text-[10px] text-slate-400 mr-1">Cambiar a:</span>
                        <button
                          type="button"
                          disabled={isUpdating || status === 'active'}
                          onClick={() => handleStatusChange(u.id, 'active')}
                          className={`px-2 py-1 rounded text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                            status === 'active'
                              ? 'opacity-40 cursor-not-allowed bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-sm'
                          }`}
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Activar (Permitir)</span>
                        </button>

                        <button
                          type="button"
                          disabled={isUpdating || status === 'pending'}
                          onClick={() => handleStatusChange(u.id, 'pending')}
                          className={`px-2 py-1 rounded text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                            status === 'pending'
                              ? 'opacity-40 cursor-not-allowed bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              : 'bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700'
                          }`}
                        >
                          <Clock className="w-3 h-3" />
                          <span>Pendiente</span>
                        </button>

                        <button
                          type="button"
                          disabled={isUpdating || status === 'revoked'}
                          onClick={() => handleStatusChange(u.id, 'revoked')}
                          className={`px-2 py-1 rounded text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                            status === 'revoked'
                              ? 'opacity-40 cursor-not-allowed bg-rose-500/10 text-rose-400 border border-rose-500/20'
                              : 'bg-slate-800 hover:bg-rose-950 text-rose-300 border border-slate-700'
                          }`}
                        >
                          <Ban className="w-3 h-3" />
                          <span>Revocar</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* TAB 2: ADMINISTRATIVE NOTIFICATIONS */}
        {activeTab === 'notifications' && (
          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {notifications.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400 space-y-1">
                <Mail className="w-8 h-8 text-slate-600 mx-auto stroke-1" />
                <p>No hay eventos ni notificaciones registradas todavía.</p>
                <p className="text-[10px] text-slate-500">
                  Las solicitudes de registro e intentos de ingreso aparecerán aquí.
                </p>
              </div>
            ) : (
              notifications.map(n => {
                const isNewReg = n.type === 'NEW_USER_REGISTERED' || n.type === 'USER_REGISTERED';
                const isActivated = n.type === 'LICENSE_ACTIVATED';
                const isRevoked = n.type === 'LICENSE_REVOKED';
                const isPendingAttempt = n.type === 'LOGIN_ATTEMPT_PENDING';

                return (
                  <div
                    key={n.id}
                    className={`border rounded-xl p-3 space-y-2 text-xs transition-colors ${
                      n.read
                        ? 'bg-slate-900/60 border-slate-800/80 text-slate-400'
                        : 'bg-slate-900 border-emerald-500/30 text-slate-200 shadow-md'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5 font-bold flex-wrap">
                          {isNewReg ? (
                            <span className="bg-emerald-500/20 text-emerald-400 text-[9px] px-1.5 py-0.5 rounded border border-emerald-500/30 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> NUEVO REGISTRO
                            </span>
                          ) : isActivated ? (
                            <span className="bg-teal-500/20 text-teal-300 text-[9px] px-1.5 py-0.5 rounded border border-teal-500/30 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> LICENCIA ACTIVADA
                            </span>
                          ) : isRevoked ? (
                            <span className="bg-rose-500/20 text-rose-400 text-[9px] px-1.5 py-0.5 rounded border border-rose-500/30 flex items-center gap-1">
                              <Ban className="w-3 h-3" /> LICENCIA REVOCADA
                            </span>
                          ) : isPendingAttempt ? (
                            <span className="bg-amber-500/20 text-amber-400 text-[9px] px-1.5 py-0.5 rounded border border-amber-500/30 flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" /> INTENTO CON PENDIENTE
                            </span>
                          ) : (
                            <span className="bg-rose-500/20 text-rose-400 text-[9px] px-1.5 py-0.5 rounded border border-rose-500/30 flex items-center gap-1">
                              <Ban className="w-3 h-3" /> INTENTO REVOCADO
                            </span>
                          )}
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                            {n.type}
                          </span>
                          <span className="text-[10px] font-mono text-slate-400">
                            {new Date(n.created_at).toLocaleString('es-AR', {
                              dateStyle: 'short',
                              timeStyle: 'short'
                            })}
                          </span>
                        </div>
                        <h4 className="font-bold text-slate-100 text-xs mt-1">{n.subject}</h4>
                        <div className="flex items-center gap-3 text-[10px] text-slate-400 font-mono pt-0.5">
                          <span>Usuario: <strong className="text-slate-200">{n.user_name}</strong></span>
                          <span>Email: <strong className="text-slate-200">{n.user_email}</strong></span>
                          <span>Producto: <strong className="text-emerald-400">{n.product_name}</strong></span>
                        </div>
                      </div>

                      {!n.read ? (
                        <button
                          type="button"
                          onClick={() => handleMarkAsRead(n.id)}
                          className="text-[10px] bg-slate-800 hover:bg-slate-700 text-emerald-400 hover:text-emerald-300 px-2 py-0.5 rounded border border-slate-700 flex items-center gap-1 cursor-pointer shrink-0"
                          title="Marcar como leída"
                        >
                          <Check className="w-3 h-3" />
                          <span>Marcar leída</span>
                        </button>
                      ) : (
                        <span className="text-[9px] text-slate-500 font-mono shrink-0">Leída</span>
                      )}
                    </div>

                    {/* Preformatted body */}
                    <pre className="text-[11px] font-sans whitespace-pre-wrap bg-slate-950/70 p-2.5 rounded-lg border border-slate-800/80 text-slate-300 leading-relaxed">
                      {n.body}
                    </pre>

                    {/* Quick activate button if user is still pending */}
                    {n.status === 'pending' && (
                      <div className="flex justify-end pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            const found = users.find(u => u.email.toLowerCase() === n.user_email.toLowerCase());
                            if (found) {
                              handleStatusChange(found.id, 'active');
                              handleMarkAsRead(n.id);
                            } else {
                              onToast('Usuario no encontrado en la lista');
                            }
                          }}
                          className="bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold px-2.5 py-1 rounded-lg flex items-center gap-1 transition-all cursor-pointer"
                        >
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          <span>Aprobar y Activar a {n.user_name}</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        <button
          type="button"
          onClick={onClose}
          className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs font-bold text-slate-300 transition-all cursor-pointer shrink-0"
        >
          Cerrar
        </button>
      </div>
    </div>
  );
};
