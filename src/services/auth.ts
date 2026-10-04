import type { User, Product, UserProduct, AdminNotification } from '../types/index.ts';

const TOKEN_KEY = 'dividimesa_auth_token';
const DB_STORAGE_KEY = 'dividimesa_client_db';
const PRIMARY_ADMIN_EMAIL = 'aiquantumstudio@gmail.com';
const DEMO_EMAIL = 'demo@aiquantumstudio.com';

export interface AuthResponse {
  token: string;
  user: User;
  product: Product;
  license: UserProduct;
  message?: string;
  error?: string;
}

interface StoredDbUser {
  id: string;
  name: string;
  email: string;
  password: string; // Plain/simple hash for client fallback
  created_at: string;
  status: 'active' | 'pending' | 'suspended';
  role: 'admin' | 'user' | 'demo';
  is_demo?: boolean;
  licenseStatus: 'pending' | 'active' | 'revoked';
  activated_at: string | null;
}

interface ClientDatabase {
  users: StoredDbUser[];
  notifications: AdminNotification[];
}

function getInitialClientDb(): ClientDatabase {
  const now = new Date().toISOString();
  return {
    users: [
      {
        id: 'usr_admin_quantum',
        name: 'AI Quantum Studio (Admin)',
        email: PRIMARY_ADMIN_EMAIL,
        password: 'admin123',
        created_at: now,
        status: 'active',
        role: 'admin',
        is_demo: false,
        licenseStatus: 'active',
        activated_at: now
      },
      {
        id: 'usr_demo_quantum',
        name: 'Demostración AI Quantum Studio',
        email: DEMO_EMAIL,
        password: 'quantum_demo_secret_2026!',
        created_at: now,
        status: 'active',
        role: 'demo',
        is_demo: true,
        licenseStatus: 'active',
        activated_at: now
      },
      {
        id: 'usr_cliente_activo',
        name: 'Cliente Activo (Ejemplo)',
        email: 'cliente.activo@ejemplo.com',
        password: 'demo123',
        created_at: now,
        status: 'active',
        role: 'user',
        is_demo: false,
        licenseStatus: 'active',
        activated_at: now
      },
      {
        id: 'usr_cliente_pendiente',
        name: 'Cliente Pendiente (Ejemplo)',
        email: 'cliente.pendiente@ejemplo.com',
        password: 'demo123',
        created_at: now,
        status: 'active',
        role: 'user',
        is_demo: false,
        licenseStatus: 'pending',
        activated_at: null
      },
      {
        id: 'usr_cliente_revocado',
        name: 'Cliente Revocado (Ejemplo)',
        email: 'cliente.revocado@ejemplo.com',
        password: 'demo123',
        created_at: now,
        status: 'active',
        role: 'user',
        is_demo: false,
        licenseStatus: 'revoked',
        activated_at: null
      }
    ],
    notifications: []
  };
}

function getClientDb(): ClientDatabase {
  try {
    const raw = localStorage.getItem(DB_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.users)) {
        return parsed;
      }
    }
  } catch {
    // fallback
  }
  const initial = getInitialClientDb();
  saveClientDb(initial);
  return initial;
}

function saveClientDb(db: ClientDatabase): void {
  try {
    localStorage.setItem(DB_STORAGE_KEY, JSON.stringify(db));
  } catch (err) {
    console.warn('LocalStorage save error:', err);
  }
}

export function getStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setStoredToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch (err) {
    console.error('Failed to set token', err);
  }
}

export function clearStoredToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch (err) {
    console.error('Failed to clear token', err);
  }
}

const defaultProduct: Product = {
  id: 'prod_dividi_mesa',
  name: 'Dividí Mesa',
  slug: 'dividi-mesa'
};

// -------------------------------------------------------------
// Universal Request: Tries Server First, Fallbacks to Local Engine
// -------------------------------------------------------------
async function tryServerRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T | null> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {})
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);

    const response = await fetch(endpoint, {
      ...options,
      headers,
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    // If server responded with HTML (e.g. 404 redirected to index.html on Netlify)
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return null;
    }

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Error en la solicitud');
    }
    return data as T;
  } catch (err: any) {
    if (
      err.name === 'AbortError' ||
      err.code === 'ERR_INVALID_URL' ||
      err.message?.includes('Failed to fetch') ||
      err.message?.includes('NetworkError') ||
      err.message?.includes('URL')
    ) {
      return null;
    }
    // If it was a real business error from a working server (e.g. "Credenciales incorrectas")
    if (err.message && !err.message.includes('JSON') && !err.message.includes('fetch')) {
      throw err;
    }
    return null;
  }
}

// -------------------------------------------------------------
// Public Auth Service (Hybrid & 100% Resilient)
// -------------------------------------------------------------
export const authService = {
  // 1. DEMO LOGIN
  async loginDemo(): Promise<AuthResponse> {
    // 1. Try server
    try {
      const serverRes = await tryServerRequest<AuthResponse>('/api/auth/demo', { method: 'POST' });
      if (serverRes) {
        if (serverRes.token) setStoredToken(serverRes.token);
        return serverRes;
      }
    } catch (err) {
      console.warn('Server demo failed, using offline engine:', err);
    }

    // 2. Client Fallback (Always 100% works)
    const db = getClientDb();
    let demoUser = db.users.find(u => u.role === 'demo');
    if (!demoUser) {
      demoUser = getInitialClientDb().users.find(u => u.role === 'demo')!;
      db.users.push(demoUser);
      saveClientDb(db);
    }

    const token = 'token_demo_' + Date.now();
    setStoredToken(token);

    const safeUser: User = {
      id: demoUser.id,
      name: demoUser.name,
      email: demoUser.email,
      created_at: demoUser.created_at,
      status: demoUser.status,
      role: demoUser.role,
      is_demo: true
    };

    const license: UserProduct = {
      id: 'lic_demo',
      user_id: demoUser.id,
      product_id: defaultProduct.id,
      status: 'active',
      activated_at: new Date().toISOString()
    };

    return { token, user: safeUser, product: defaultProduct, license };
  },

  // 2. STANDARD LOGIN
  async login(email: string, password: string): Promise<AuthResponse> {
    const cleanEmail = email.trim().toLowerCase();

    // 1. Try server
    try {
      const serverRes = await tryServerRequest<AuthResponse>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: cleanEmail, password })
      });
      if (serverRes) {
        if (serverRes.token) setStoredToken(serverRes.token);
        return serverRes;
      }
    } catch (err: any) {
      // If server returned intentional error like "Credenciales incorrectas", throw it
      if (err.message && !err.message.includes('fetch') && !err.message.includes('servidor')) {
        throw err;
      }
    }

    // 2. Client Fallback
    const db = getClientDb();
    const user = db.users.find(u => u.email.toLowerCase() === cleanEmail);

    if (!user || user.password !== password) {
      throw new Error('Credenciales incorrectas');
    }

    const token = `token_${user.id}_${Date.now()}`;
    setStoredToken(token);

    const safeUser: User = {
      id: user.id,
      name: user.name,
      email: user.email,
      created_at: user.created_at,
      status: user.status,
      role: user.role,
      is_demo: user.is_demo || false
    };

    const license: UserProduct = {
      id: `lic_${user.id}`,
      user_id: user.id,
      product_id: defaultProduct.id,
      status: user.licenseStatus,
      activated_at: user.activated_at
    };

    return { token, user: safeUser, product: defaultProduct, license };
  },

  // 3. REGISTER
  async register(name: string, email: string, password: string): Promise<AuthResponse> {
    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim();

    // 1. Try server
    try {
      const serverRes = await tryServerRequest<AuthResponse>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name: cleanName, email: cleanEmail, password })
      });
      if (serverRes) {
        if (serverRes.token) setStoredToken(serverRes.token);
        return serverRes;
      }
    } catch (err: any) {
      if (err.message && !err.message.includes('fetch') && !err.message.includes('servidor')) {
        throw err;
      }
    }

    // 2. Client Fallback
    const db = getClientDb();
    const existing = db.users.find(u => u.email.toLowerCase() === cleanEmail);
    if (existing) {
      throw new Error('Ya existe una cuenta con este correo');
    }

    const newUserId = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();

    const newUser: StoredDbUser = {
      id: newUserId,
      name: cleanName,
      email: cleanEmail,
      password: password,
      created_at: now,
      status: 'active',
      role: 'user',
      is_demo: false,
      licenseStatus: 'pending',
      activated_at: null
    };

    db.users.push(newUser);

    const dateFormatted = new Date().toLocaleString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const subject = `NUEVA SOLICITUD DE ACCESO — DIVIDÍ MESA (${cleanName})`;
    const body = `NUEVA SOLICITUD DE ACCESO — DIVIDÍ MESA\n\n` +
      `Nombre:\n${cleanName}\n\n` +
      `Email:\n${cleanEmail}\n\n` +
      `Producto:\nDividí Mesa\n\n` +
      `Estado:\nPendiente\n\n` +
      `Fecha:\n${dateFormatted}\n\n` +
      `ID de Usuario:\n${newUserId}\n\n` +
      `El usuario está esperando aprobación.`;

    const notif: AdminNotification = {
      id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      type: 'NEW_USER_REGISTERED',
      user_name: cleanName,
      user_email: cleanEmail,
      product_name: 'Dividí Mesa',
      product_slug: 'dividi-mesa',
      status: 'pending',
      recipient: PRIMARY_ADMIN_EMAIL,
      created_at: now,
      read: false,
      subject,
      body
    };
    db.notifications.unshift(notif);
    saveClientDb(db);

    const token = `token_${newUserId}_${Date.now()}`;
    setStoredToken(token);

    const safeUser: User = {
      id: newUser.id,
      name: newUser.name,
      email: newUser.email,
      created_at: newUser.created_at,
      status: newUser.status,
      role: newUser.role,
      is_demo: false
    };

    const license: UserProduct = {
      id: `lic_${newUserId}`,
      user_id: newUserId,
      product_id: defaultProduct.id,
      status: 'pending',
      activated_at: null
    };

    return {
      token,
      user: safeUser,
      product: defaultProduct,
      license,
      message: 'Cuenta creada con éxito. Permiso Dividí Mesa: Pendiente de activación por AI Quantum Studio.'
    };
  },

  // 4. ME (Session Verification)
  async getMe(): Promise<{ user: User; product: Product; license: UserProduct }> {
    const token = getStoredToken();
    if (!token) {
      throw new Error('No hay sesión activa');
    }

    // 1. Try server
    try {
      const serverRes = await tryServerRequest<{ user: User; product: Product; license: UserProduct }>('/api/auth/me');
      if (serverRes) {
        return serverRes;
      }
    } catch {
      // ignore
    }

    // 2. Client Fallback
    const db = getClientDb();
    let foundUser: StoredDbUser | undefined;

    if (token.startsWith('token_demo_')) {
      foundUser = db.users.find(u => u.role === 'demo');
    } else {
      const parts = token.split('_');
      const userId = parts.length >= 2 ? `${parts[0]}_${parts[1]}` : null;
      foundUser = db.users.find(u => u.id === userId || token.includes(u.id));
    }

    if (!foundUser) {
      // Default to demo if token looks like demo
      if (token.includes('demo')) {
        foundUser = db.users.find(u => u.role === 'demo');
      }
    }

    if (!foundUser) {
      clearStoredToken();
      throw new Error('Sesión expirada');
    }

    const safeUser: User = {
      id: foundUser.id,
      name: foundUser.name,
      email: foundUser.email,
      created_at: foundUser.created_at,
      status: foundUser.status,
      role: foundUser.role,
      is_demo: foundUser.is_demo || false
    };

    const license: UserProduct = {
      id: `lic_${foundUser.id}`,
      user_id: foundUser.id,
      product_id: defaultProduct.id,
      status: foundUser.licenseStatus,
      activated_at: foundUser.activated_at
    };

    return { user: safeUser, product: defaultProduct, license };
  },

  // 5. FORGOT PASSWORD
  async forgotPassword(email: string, newPassword?: string): Promise<{ message: string; verified?: boolean }> {
    const cleanEmail = email.trim().toLowerCase();

    // 1. Try server
    try {
      const serverRes = await tryServerRequest<{ message: string; verified?: boolean }>('/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email: cleanEmail, newPassword })
      });
      if (serverRes) {
        return serverRes;
      }
    } catch (err: any) {
      if (err.message && !err.message.includes('fetch') && !err.message.includes('servidor')) {
        throw err;
      }
    }

    // 2. Client Fallback
    const db = getClientDb();
    const user = db.users.find(u => u.email.toLowerCase() === cleanEmail);

    if (!user) {
      throw new Error('No se encontró ningún usuario con ese correo');
    }

    if (newPassword && newPassword.length >= 4) {
      user.password = newPassword;
      saveClientDb(db);
      return { message: 'Contraseña restablecida con éxito. Ya podés iniciar sesión.' };
    }

    return { message: 'Se validó tu identidad. Ingresá una nueva contraseña.', verified: true };
  },

  // 6. LOGOUT
  async logout(): Promise<void> {
    try {
      await tryServerRequest('/api/auth/logout', { method: 'POST' });
    } catch {
      // ignore
    } finally {
      clearStoredToken();
    }
  },

  // 7. ADMIN USERS
  async getAdminUsers(): Promise<{ users: any[] }> {
    // 1. Try server
    try {
      const serverRes = await tryServerRequest<{ users: any[] }>('/api/admin/users');
      if (serverRes && Array.isArray(serverRes.users)) {
        return serverRes;
      }
    } catch {
      // ignore
    }

    // 2. Client Fallback
    const db = getClientDb();
    const users = db.users.map(u => ({
      id: u.id,
      name: u.name,
      email: u.email,
      created_at: u.created_at,
      status: u.status,
      role: u.role,
      is_demo: u.is_demo || false,
      licenseStatus: u.licenseStatus,
      activated_at: u.activated_at
    }));

    return { users };
  },

  // 8. ADMIN UPDATE LICENSE
  async updateLicense(targetUserId: string, newStatus: 'pending' | 'active' | 'revoked'): Promise<{ message: string; license: UserProduct; emailSent?: boolean; emailError?: string }> {
    // 1. Try server
    try {
      const serverRes = await tryServerRequest<{ message: string; license: UserProduct; emailSent?: boolean; emailError?: string }>('/api/admin/update-license', {
        method: 'POST',
        body: JSON.stringify({ targetUserId, newStatus })
      });
      if (serverRes) {
        return serverRes;
      }
    } catch (err: any) {
      if (err.message && !err.message.includes('fetch') && !err.message.includes('servidor')) {
        throw err;
      }
    }

    // 2. Client Fallback
    const db = getClientDb();
    const targetUser = db.users.find(u => u.id === targetUserId);
    if (!targetUser) {
      throw new Error('Usuario no encontrado');
    }

    targetUser.licenseStatus = newStatus;
    if (newStatus === 'active') {
      targetUser.activated_at = new Date().toISOString();
    } else if (newStatus === 'revoked') {
      targetUser.activated_at = null;
    }

    if (newStatus === 'active' || newStatus === 'revoked') {
      const actionType = newStatus === 'active' ? 'LICENSE_ACTIVATED' : 'LICENSE_REVOKED';
      const actionLabel = newStatus === 'active' ? 'Activada' : 'Revocada';
      const auditNotif: AdminNotification = {
        id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        type: actionType,
        user_name: targetUser.name,
        user_email: targetUser.email,
        product_name: defaultProduct.name,
        product_slug: defaultProduct.slug,
        status: newStatus,
        recipient: PRIMARY_ADMIN_EMAIL,
        created_at: new Date().toISOString(),
        read: false,
        subject: `[Licencia ${actionLabel}] ${targetUser.name} (${defaultProduct.name})`,
        body: `La licencia del producto ${defaultProduct.name} para el usuario ${targetUser.name} (${targetUser.email}) fue cambiada a estado ${newStatus.toUpperCase()}.`
      };
      db.notifications.unshift(auditNotif);
    }
    saveClientDb(db);

    const license: UserProduct = {
      id: `lic_${targetUser.id}`,
      user_id: targetUser.id,
      product_id: defaultProduct.id,
      status: targetUser.licenseStatus,
      activated_at: targetUser.activated_at
    };

    return { message: `Licencia actualizada a: ${newStatus}`, license };
  },

  // 9. ADMIN NOTIFICATIONS
  async getAdminNotifications(): Promise<{ notifications: any[] }> {
    try {
      const serverRes = await tryServerRequest<{ notifications: any[] }>('/api/admin/notifications');
      if (serverRes && Array.isArray(serverRes.notifications)) {
        return serverRes;
      }
    } catch {
      // ignore
    }

    const db = getClientDb();
    return { notifications: db.notifications || [] };
  },

  // 10. MARK NOTIFICATION READ
  async markNotificationRead(id: string): Promise<{ success: boolean }> {
    try {
      const serverRes = await tryServerRequest<{ success: boolean }>(`/api/admin/notifications/${id}/read`, {
        method: 'POST'
      });
      if (serverRes) {
        return serverRes;
      }
    } catch {
      // ignore
    }

    const db = getClientDb();
    const notif = db.notifications.find(n => n.id === id);
    if (notif) {
      notif.read = true;
      saveClientDb(db);
    }
    return { success: true };
  }
};
