import { User, Product, UserProduct } from '../types';

const TOKEN_KEY = 'dividimesa_auth_token';

export interface AuthResponse {
  token: string;
  user: User;
  product: Product;
  license: UserProduct;
  message?: string;
  error?: string;
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

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {})
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(endpoint, {
    ...options,
    headers
  });

  const data = await response.json().catch(() => ({ error: 'Error de respuesta del servidor' }));

  if (!response.ok) {
    throw new Error(data.error || 'Error en la solicitud');
  }

  return data as T;
}

export const authService = {
  async loginDemo(): Promise<AuthResponse> {
    const data = await request<AuthResponse>('/api/auth/demo', {
      method: 'POST'
    });
    if (data.token) {
      setStoredToken(data.token);
    }
    return data;
  },

  async login(email: string, password: string): Promise<AuthResponse> {
    const data = await request<AuthResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    if (data.token) {
      setStoredToken(data.token);
    }
    return data;
  },

  async register(name: string, email: string, password: string): Promise<AuthResponse> {
    const data = await request<AuthResponse>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password })
    });
    if (data.token) {
      setStoredToken(data.token);
    }
    return data;
  },

  async getMe(): Promise<{ user: User; product: Product; license: UserProduct }> {
    return await request<{ user: User; product: Product; license: UserProduct }>('/api/auth/me');
  },

  async forgotPassword(email: string, newPassword?: string): Promise<{ message: string; verified?: boolean }> {
    return await request<{ message: string; verified?: boolean }>('/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email, newPassword })
    });
  },

  async logout(): Promise<void> {
    try {
      await request('/api/auth/logout', { method: 'POST' });
    } catch {
      // ignore
    } finally {
      clearStoredToken();
    }
  },

  async getAdminUsers(): Promise<{ users: any[] }> {
    return await request<{ users: any[] }>('/api/admin/users');
  },

  async getAdminNotifications(): Promise<{ notifications: any[] }> {
    return await request<{ notifications: any[] }>('/api/admin/notifications');
  },

  async markNotificationRead(id: string): Promise<{ success: boolean }> {
    return await request<{ success: boolean }>(`/api/admin/notifications/${id}/read`, {
      method: 'POST'
    });
  },

  async updateLicense(targetUserId: string, newStatus: 'pending' | 'active' | 'revoked'): Promise<{ message: string; license: UserProduct }> {
    return await request<{ message: string; license: UserProduct }>('/api/admin/update-license', {
      method: 'POST',
      body: JSON.stringify({ targetUserId, newStatus })
    });
  }
};
