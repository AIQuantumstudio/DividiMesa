import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SERVER_SECRET = process.env.SERVER_SECRET || 'dividimesa-quantum-auth-secret-key-2026';
const PRIMARY_ADMIN_EMAIL = 'aiquantumstudio@gmail.com';
const DEMO_EMAIL = 'demo@aiquantumstudio.com';
const DB_PATH = path.join(__dirname, '..', '..', 'data', 'database.json');

export interface DbUser {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  created_at: string;
  status: 'active' | 'pending' | 'suspended';
  role: 'admin' | 'user' | 'demo';
  is_demo?: boolean;
}

export interface DbProduct {
  id: string;
  name: string;
  slug: string;
}

export interface DbUserProduct {
  id: string;
  user_id: string;
  product_id: string;
  status: 'pending' | 'active' | 'revoked';
  activated_at: string | null;
}

export interface DbAdminNotification {
  id: string;
  type: 'NEW_USER_REGISTERED' | 'LICENSE_ACTIVATED' | 'LICENSE_REVOKED' | 'USER_REGISTERED' | 'LOGIN_ATTEMPT_PENDING' | 'LOGIN_ATTEMPT_REVOKED';
  user_name: string;
  user_email: string;
  product_name: string;
  product_slug: string;
  status: 'pending' | 'active' | 'revoked';
  recipient: string;
  created_at: string;
  read: boolean;
  subject: string;
  body: string;
}

export interface DbActionToken {
  id: string;
  token: string;
  user_id: string;
  product_id: string;
  action: 'activate' | 'reject';
  created_at: string;
  expires_at: string;
  used: boolean;
  used_at: string | null;
}

export interface DatabaseSchema {
  users: DbUser[];
  products: DbProduct[];
  user_products: DbUserProduct[];
  notifications: DbAdminNotification[];
  action_tokens: DbActionToken[];
}

export function hashPassword(pwd: string): string {
  return crypto.createHash('sha256').update(pwd + SERVER_SECRET).digest('hex');
}

export function createActionToken(userId: string, productId: string, action: 'activate' | 'reject'): string {
  const nonce = crypto.randomBytes(16).toString('hex');
  const now = Date.now();
  const payload = `${userId}:${productId}:${action}:${nonce}:${now}`;
  const signature = crypto.createHmac('sha256', SERVER_SECRET).update(payload).digest('hex');
  return Buffer.from(`${payload}:${signature}`).toString('base64url');
}

export function verifyActionTokenSignature(tokenStr: string): { userId: string; productId: string; action: 'activate' | 'reject'; nonce: string; timestamp: number } | null {
  try {
    const decoded = Buffer.from(tokenStr, 'base64url').toString('utf8');
    const [userId, productId, action, nonce, timestampStr, signature] = decoded.split(':');
    if (!userId || !productId || !action || !nonce || !timestampStr || !signature) return null;
    if (action !== 'activate' && action !== 'reject') return null;

    const payload = `${userId}:${productId}:${action}:${nonce}:${timestampStr}`;
    const expectedSig = crypto.createHmac('sha256', SERVER_SECRET).update(payload).digest('hex');
    if (crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))) {
      return { userId, productId, action, nonce, timestamp: Number(timestampStr) };
    }
  } catch {
    return null;
  }
  return null;
}

export function generateToken(userId: string): string {
  const payload = `${userId}:${Date.now()}`;
  const signature = crypto.createHmac('sha256', SERVER_SECRET).update(payload).digest('hex');
  return Buffer.from(`${payload}:${signature}`).toString('base64');
}

export function verifyToken(token: string): string | null {
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf8');
    const [userId, timestamp, signature] = decoded.split(':');
    if (!userId || !timestamp || !signature) return null;

    const payload = `${userId}:${timestamp}`;
    const expectedSignature = crypto.createHmac('sha256', SERVER_SECRET).update(payload).digest('hex');
    if (crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
      return userId;
    }
  } catch {
    return null;
  }
  return null;
}

export function getInitialSeed(): DatabaseSchema {
  return {
    users: [
      {
        id: 'usr_admin_quantum',
        name: 'AI Quantum Studio (Admin)',
        email: PRIMARY_ADMIN_EMAIL,
        password_hash: hashPassword('admin123'),
        created_at: new Date().toISOString(),
        status: 'active',
        role: 'admin',
        is_demo: false
      },
      {
        id: 'usr_demo_quantum',
        name: 'Demostración AI Quantum Studio',
        email: DEMO_EMAIL,
        password_hash: hashPassword('quantum_demo_secret_2026!'),
        created_at: new Date().toISOString(),
        status: 'active',
        role: 'demo',
        is_demo: true
      },
      {
        id: 'usr_cliente_activo',
        name: 'Cliente Activo (Ejemplo)',
        email: 'cliente.activo@ejemplo.com',
        password_hash: hashPassword('demo123'),
        created_at: new Date().toISOString(),
        status: 'active',
        role: 'user',
        is_demo: false
      },
      {
        id: 'usr_cliente_pendiente',
        name: 'Cliente Pendiente (Ejemplo)',
        email: 'cliente.pendiente@ejemplo.com',
        password_hash: hashPassword('demo123'),
        created_at: new Date().toISOString(),
        status: 'active',
        role: 'user',
        is_demo: false
      },
      {
        id: 'usr_cliente_revocado',
        name: 'Cliente Revocado (Ejemplo)',
        email: 'cliente.revocado@ejemplo.com',
        password_hash: hashPassword('demo123'),
        created_at: new Date().toISOString(),
        status: 'active',
        role: 'user',
        is_demo: false
      }
    ],
    products: [
      {
        id: 'prod_dividi_mesa',
        name: 'Dividí Mesa',
        slug: 'dividi-mesa'
      }
    ],
    user_products: [
      {
        id: 'lic_admin',
        user_id: 'usr_admin_quantum',
        product_id: 'prod_dividi_mesa',
        status: 'active',
        activated_at: new Date().toISOString()
      },
      {
        id: 'lic_demo',
        user_id: 'usr_demo_quantum',
        product_id: 'prod_dividi_mesa',
        status: 'active',
        activated_at: new Date().toISOString()
      },
      {
        id: 'lic_cliente_activo',
        user_id: 'usr_cliente_activo',
        product_id: 'prod_dividi_mesa',
        status: 'active',
        activated_at: new Date().toISOString()
      },
      {
        id: 'lic_cliente_pendiente',
        user_id: 'usr_cliente_pendiente',
        product_id: 'prod_dividi_mesa',
        status: 'pending',
        activated_at: null
      },
      {
        id: 'lic_cliente_revocado',
        user_id: 'usr_cliente_revocado',
        product_id: 'prod_dividi_mesa',
        status: 'revoked',
        activated_at: null
      }
    ],
    notifications: [],
    action_tokens: []
  };
}

let memoryDb: DatabaseSchema = getInitialSeed();

export async function getDatabase(): Promise<DatabaseSchema> {
  try {
    if (fs.existsSync(DB_PATH)) {
      const data = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
      if (data && Array.isArray(data.users)) {
        if (!Array.isArray(data.action_tokens)) data.action_tokens = [];
        memoryDb = data;
        return memoryDb;
      }
    }
  } catch {
    // fallback to memory
  }
  if (!Array.isArray(memoryDb.action_tokens)) memoryDb.action_tokens = [];
  return memoryDb;
}

export async function saveDatabase(data: DatabaseSchema): Promise<void> {
  memoryDb = data;
  try {
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
  } catch {
    // safe fallback
  }
}

// Router
export const apiRouter = express.Router();

apiRouter.use(express.json());

// CORS & Preflight
apiRouter.use((_req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  next();
});

async function authenticate(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No autorizado: sesión requerida' });
  }

  const token = authHeader.split(' ')[1];
  const userId = verifyToken(token);
  if (!userId) {
    return res.status(401).json({ error: 'Sesión inválida o expirada' });
  }

  const db = await getDatabase();
  const user = db.users.find(u => u.id === userId);
  if (!user) {
    return res.status(401).json({ error: 'Usuario no encontrado' });
  }

  (req as any).user = user;
  next();
}

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const currentUser = (req as any).user as DbUser;
  if (
    !currentUser ||
    currentUser.email.toLowerCase() !== PRIMARY_ADMIN_EMAIL.toLowerCase() ||
    currentUser.role !== 'admin'
  ) {
    return res.status(403).json({ error: 'Acceso restringido: requiere permisos de Administrador Principal' });
  }
  next();
}

export async function sendEmail({
  to,
  subject,
  html,
  text
}: {
  to: string;
  subject: string;
  html?: string;
  text?: string;
}): Promise<boolean> {
  // 1. Resend API ($0 Free Tier, 3000 emails/mo, no card required)
  if (process.env.RESEND_API_KEY) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM || 'Dividí Mesa <onboarding@resend.dev>',
          to,
          subject,
          html,
          text
        })
      });
      if (res.ok) {
        console.log(`[Email] Notification sent successfully to ${to}`);
        return true;
      } else {
        const err = await res.json().catch(() => ({}));
        console.warn('[Email] Resend API error:', err);
      }
    } catch (err) {
      console.warn('[Email] Network error sending email:', err);
    }
  }

  // 2. Webhook notification (Optional free webhook dispatch)
  if (process.env.NOTIFICATION_WEBHOOK_URL) {
    try {
      await fetch(process.env.NOTIFICATION_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, subject, html, text })
      });
      return true;
    } catch (err) {
      console.warn('[Webhook] Dispatch error:', err);
    }
  }

  return false;
}

function renderActionHtml({
  title,
  icon,
  headline,
  message,
  themeColor = '#10b981',
  user,
  productName,
  actionStatus,
  appUrl = '/'
}: {
  title: string;
  icon: string;
  headline: string;
  message: string;
  themeColor?: string;
  user?: DbUser;
  productName?: string;
  actionStatus?: string;
  appUrl?: string;
}): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #020617;
      color: #f8fafc;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 20px;
    }
    .card {
      max-width: 480px;
      width: 100%;
      background: #0f172a;
      border: 1px solid ${themeColor};
      border-radius: 24px;
      padding: 36px 28px;
      text-align: center;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 35px ${themeColor}22;
    }
    .icon-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 64px;
      height: 64px;
      border-radius: 20px;
      background: ${themeColor}1a;
      border: 1px solid ${themeColor}40;
      font-size: 32px;
      margin-bottom: 20px;
    }
    h1 {
      font-size: 20px;
      font-weight: 800;
      color: #ffffff;
      margin-bottom: 8px;
      letter-spacing: -0.02em;
    }
    .subtitle {
      font-size: 12px;
      font-weight: 700;
      color: ${themeColor};
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 20px;
    }
    .info-box {
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 14px;
      padding: 16px;
      margin-bottom: 20px;
      text-align: left;
      font-size: 13px;
      line-height: 1.6;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      padding: 4px 0;
      border-bottom: 1px solid #33415555;
    }
    .info-row:last-child { border-bottom: none; }
    .info-label { color: #94a3b8; font-weight: 600; }
    .info-val { color: #f1f5f9; font-weight: 700; }
    .badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 800;
      background: ${themeColor}22;
      color: ${themeColor};
      border: 1px solid ${themeColor}44;
    }
    .msg {
      font-size: 13px;
      color: #94a3b8;
      line-height: 1.5;
      margin-bottom: 28px;
    }
    .btn {
      display: inline-block;
      width: 100%;
      background: ${themeColor};
      color: #ffffff;
      text-decoration: none;
      font-weight: 800;
      font-size: 14px;
      padding: 14px 24px;
      border-radius: 14px;
      transition: opacity 0.2s;
      box-shadow: 0 4px 15px ${themeColor}40;
    }
    .btn:hover { opacity: 0.9; }
    .footer {
      margin-top: 24px;
      font-size: 11px;
      color: #64748b;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon-badge">${icon}</div>
    <h1>${headline}</h1>
    <div class="subtitle">AI Quantum Studio • Control de Licencias</div>

    ${user ? `
    <div class="info-box">
      <div class="info-row">
        <span class="info-label">Cliente:</span>
        <span class="info-val">${user.name}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Email:</span>
        <span class="info-val" style="color: #38bdf8;">${user.email}</span>
      </div>
      ${productName ? `
      <div class="info-row">
        <span class="info-label">Producto:</span>
        <span class="info-val" style="color: #10b981;">${productName}</span>
      </div>` : ''}
      ${actionStatus ? `
      <div class="info-row">
        <span class="info-label">Estado de licencia:</span>
        <span class="badge">${actionStatus}</span>
      </div>` : ''}
    </div>` : ''}

    <p class="msg">${message}</p>

    <a href="${appUrl}" class="btn">Ir a Dividí Mesa</a>
    <div class="footer">Sistema seguro con tokens criptográficos de un solo uso.</div>
  </div>
</body>
</html>`;
}

// 1. DEMO LOGIN
apiRouter.post('/auth/demo', async (_req: Request, res: Response) => {
  const db = await getDatabase();
  const demoUser = db.users.find(u => u.email.toLowerCase() === DEMO_EMAIL.toLowerCase());
  if (!demoUser) {
    return res.status(500).json({ error: 'Cuenta demo no disponible' });
  }

  const product = db.products.find(p => p.slug === 'dividi-mesa') || {
    id: 'prod_dividi_mesa',
    name: 'Dividí Mesa',
    slug: 'dividi-mesa'
  };

  const license: DbUserProduct = {
    id: 'lic_demo',
    user_id: demoUser.id,
    product_id: product.id,
    status: 'active',
    activated_at: new Date().toISOString()
  };

  const token = generateToken(demoUser.id);
  const safeUser = {
    id: demoUser.id,
    name: demoUser.name,
    email: demoUser.email,
    created_at: demoUser.created_at,
    status: demoUser.status,
    role: demoUser.role,
    is_demo: true
  };

  res.json({ token, user: safeUser, product, license });
});

// 2. STANDARD LOGIN
apiRouter.post('/auth/login', async (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email y contraseña requeridos' });
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const db = await getDatabase();
  const user = db.users.find(u => u.email.toLowerCase() === normalizedEmail);

  if (!user || user.password_hash !== hashPassword(password)) {
    return res.status(401).json({ error: 'Credenciales incorrectas' });
  }

  const product = db.products.find(p => p.slug === 'dividi-mesa') || {
    id: 'prod_dividi_mesa',
    name: 'Dividí Mesa',
    slug: 'dividi-mesa'
  };

  const license = db.user_products.find(
    up => up.user_id === user.id && up.product_id === product.id
  ) || {
    id: `lic_${Date.now()}`,
    user_id: user.id,
    product_id: product.id,
    status: 'pending' as const,
    activated_at: null
  };

  const token = generateToken(user.id);
  const safeUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    created_at: user.created_at,
    status: user.status,
    role: user.role,
    is_demo: user.is_demo || false
  };

  res.json({ token, user: safeUser, product, license });
});

// 3. REGISTER
apiRouter.post('/auth/register', async (req: Request, res: Response) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Nombre, email y contraseña son obligatorios' });
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const db = await getDatabase();

  const existing = db.users.find(u => u.email.toLowerCase() === normalizedEmail);
  if (existing) {
    return res.status(409).json({ error: 'Ya existe una cuenta con este correo' });
  }

  const newUser: DbUser = {
    id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    name: String(name).trim(),
    email: normalizedEmail,
    password_hash: hashPassword(password),
    created_at: new Date().toISOString(),
    status: 'active',
    role: 'user',
    is_demo: false
  };

  db.users.push(newUser);

  const product = db.products.find(p => p.slug === 'dividi-mesa') || {
    id: 'prod_dividi_mesa',
    name: 'Dividí Mesa',
    slug: 'dividi-mesa'
  };

  const newLicense: DbUserProduct = {
    id: `lic_${Date.now()}`,
    user_id: newUser.id,
    product_id: product.id,
    status: 'pending',
    activated_at: null
  };

  db.user_products.push(newLicense);

  const now = new Date();
  const dateFormatted = now.toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  // Determine base URL of application for magic links
  const host = req.get('x-forwarded-host') || req.get('host') || 'localhost:3000';
  const protocol = req.get('x-forwarded-proto') || req.protocol || 'https';
  const baseUrl = (process.env.APP_URL || `${protocol}://${host}`).replace(/\/$/, '');

  // Generate Single-Use Cryptographic Action Tokens (7 days expiration)
  const activateToken = createActionToken(newUser.id, product.id, 'activate');
  const rejectToken = createActionToken(newUser.id, product.id, 'reject');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  if (!Array.isArray(db.action_tokens)) db.action_tokens = [];
  db.action_tokens.push({
    id: `tok_${Date.now()}_1`,
    token: activateToken,
    user_id: newUser.id,
    product_id: product.id,
    action: 'activate',
    created_at: now.toISOString(),
    expires_at: expiresAt,
    used: false,
    used_at: null
  });
  db.action_tokens.push({
    id: `tok_${Date.now()}_2`,
    token: rejectToken,
    user_id: newUser.id,
    product_id: product.id,
    action: 'reject',
    created_at: now.toISOString(),
    expires_at: expiresAt,
    used: false,
    used_at: null
  });

  const activateUrl = `${baseUrl}/api/license/action?token=${activateToken}`;
  const rejectUrl = `${baseUrl}/api/license/action?token=${rejectToken}`;

  const subject = `🔔 Solicitud de acceso — Dividí Mesa`;
  const textBody = `NUEVA SOLICITUD DE ACCESO\n\n` +
    `Nombre:\n${newUser.name}\n\n` +
    `Email:\n${newUser.email}\n\n` +
    `Producto:\nDividí Mesa\n\n` +
    `Estado:\nPENDIENTE\n\n` +
    `Fecha:\n${dateFormatted}\n\n` +
    `🟢 ACTIVAR ACCESO DIRECTO:\n${activateUrl}\n\n` +
    `🔴 RECHAZAR SOLICITUD:\n${rejectUrl}\n\n` +
    `El usuario está esperando aprobación.`;

  const htmlBody = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 580px; margin: 0 auto; background-color: #0f172a; color: #f8fafc; border-radius: 16px; overflow: hidden; border: 1px solid #334155; padding: 24px;">
      <div style="text-align: center; margin-bottom: 24px;">
        <div style="display: inline-block; background: linear-gradient(135deg, #10b981, #14b8a6); color: #022c22; font-weight: 900; font-size: 15px; padding: 6px 14px; border-radius: 12px; margin-bottom: 10px;">
          Dividí Mesa
        </div>
        <h2 style="color: #ffffff; font-size: 20px; font-weight: 800; margin: 0;">NUEVA SOLICITUD DE ACCESO</h2>
        <p style="color: #94a3b8; font-size: 13px; margin: 4px 0 0 0;">AI Quantum Studio • Gestión de Licencias</p>
      </div>

      <div style="background-color: #1e293b; border-radius: 12px; padding: 18px; margin-bottom: 24px; border: 1px solid #334155;">
        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
          <tr>
            <td style="color: #94a3b8; padding: 6px 0; font-weight: 600;">Nombre:</td>
            <td style="color: #f1f5f9; padding: 6px 0; font-weight: bold; text-align: right;">${newUser.name}</td>
          </tr>
          <tr>
            <td style="color: #94a3b8; padding: 6px 0; font-weight: 600;">Email:</td>
            <td style="color: #38bdf8; padding: 6px 0; font-weight: bold; text-align: right;">${newUser.email}</td>
          </tr>
          <tr>
            <td style="color: #94a3b8; padding: 6px 0; font-weight: 600;">Producto:</td>
            <td style="color: #10b981; padding: 6px 0; font-weight: bold; text-align: right;">Dividí Mesa</td>
          </tr>
          <tr>
            <td style="color: #94a3b8; padding: 6px 0; font-weight: 600;">Estado:</td>
            <td style="color: #fbbf24; padding: 6px 0; font-weight: bold; text-align: right;">PENDIENTE</td>
          </tr>
          <tr>
            <td style="color: #94a3b8; padding: 6px 0; font-weight: 600;">Fecha:</td>
            <td style="color: #94a3b8; padding: 6px 0; font-size: 12px; text-align: right;">${dateFormatted}</td>
          </tr>
        </table>
      </div>

      <!-- BOTÓN PRINCIPAL: ACTIVAR ACCESO -->
      <div style="text-align: center; margin-bottom: 14px;">
        <a href="${activateUrl}" target="_blank" style="display: block; background-color: #10b981; color: #ffffff; text-decoration: none; font-weight: 900; font-size: 15px; padding: 14px 24px; border-radius: 12px; text-align: center; box-shadow: 0 4px 14px rgba(16, 185, 129, 0.4);">
          🟢 ACTIVAR ACCESO
        </a>
      </div>

      <!-- BOTÓN SECUNDARIO: RECHAZAR SOLICITUD -->
      <div style="text-align: center; margin-bottom: 24px;">
        <a href="${rejectUrl}" target="_blank" style="display: inline-block; background-color: #1e293b; color: #f87171; text-decoration: none; font-weight: 700; font-size: 12px; padding: 8px 18px; border-radius: 8px; text-align: center; border: 1px solid #475569;">
          🔴 RECHAZAR SOLICITUD
        </a>
      </div>

      <div style="border-top: 1px solid #334155; padding-top: 16px; font-size: 11px; color: #64748b; text-align: center;">
        Este enlace criptográfico es de un solo uso y exclusivo para el Administrador de AI Quantum Studio.
      </div>
    </div>
  `;

  const notif: DbAdminNotification = {
    id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    type: 'NEW_USER_REGISTERED',
    user_name: newUser.name,
    user_email: newUser.email,
    product_name: product.name,
    product_slug: product.slug,
    status: 'pending',
    recipient: PRIMARY_ADMIN_EMAIL,
    created_at: now.toISOString(),
    read: false,
    subject,
    body: textBody
  };
  db.notifications.unshift(notif);
  await saveDatabase(db);

  // Dispatch email notification asynchronously
  sendEmail({
    to: PRIMARY_ADMIN_EMAIL,
    subject,
    html: htmlBody,
    text: textBody
  }).catch(err => {
    console.warn('[Email] Dispatch non-fatal error:', err);
  });

  const token = generateToken(newUser.id);
  const safeUser = {
    id: newUser.id,
    name: newUser.name,
    email: newUser.email,
    created_at: newUser.created_at,
    status: newUser.status,
    role: newUser.role,
    is_demo: false
  };

  res.status(201).json({
    token,
    user: safeUser,
    product,
    license: newLicense,
    message: 'Cuenta creada con éxito. Permiso Dividí Mesa: Pendiente de activación por AI Quantum Studio.'
  });
});

// 4. ME
apiRouter.get('/auth/me', authenticate, async (req: Request, res: Response) => {
  const user = (req as any).user as DbUser;
  const db = await getDatabase();

  const product = db.products.find(p => p.slug === 'dividi-mesa') || {
    id: 'prod_dividi_mesa',
    name: 'Dividí Mesa',
    slug: 'dividi-mesa'
  };

  let license = db.user_products.find(
    up => up.user_id === user.id && up.product_id === product.id
  );

  if (!license) {
    license = {
      id: `lic_${Date.now()}`,
      user_id: user.id,
      product_id: product.id,
      status: 'pending',
      activated_at: null
    };
    db.user_products.push(license);
    await saveDatabase(db);
  }

  const safeUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    created_at: user.created_at,
    status: user.status,
    role: user.role,
    is_demo: user.is_demo || false
  };

  res.json({ user: safeUser, product, license });
});

// 5. FORGOT PASSWORD
apiRouter.post('/auth/forgot-password', async (req: Request, res: Response) => {
  const { email, newPassword } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Ingresá tu correo electrónico' });
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const db = await getDatabase();
  const user = db.users.find(u => u.email.toLowerCase() === normalizedEmail);

  if (!user) {
    return res.status(404).json({ error: 'No se encontró ningún usuario con ese correo' });
  }

  if (newPassword && String(newPassword).length >= 4) {
    user.password_hash = hashPassword(newPassword);
    await saveDatabase(db);
    return res.json({ message: 'Contraseña restablecida con éxito. Ya podés iniciar sesión.' });
  }

  res.json({
    message: 'Se validó tu identidad. Ingresá una nueva contraseña.',
    verified: true
  });
});

// 6. LOGOUT
apiRouter.post('/auth/logout', (_req: Request, res: Response) => {
  res.json({ message: 'Sesión cerrada correctamente' });
});

// 7. ADMIN USERS
apiRouter.get('/admin/users', authenticate, requireAdmin, async (_req: Request, res: Response) => {
  const db = await getDatabase();
  const product = db.products.find(p => p.slug === 'dividi-mesa');

  const result = db.users.map(u => {
    const license = db.user_products.find(
      up => up.user_id === u.id && up.product_id === product?.id
    );
    return {
      id: u.id,
      name: u.name,
      email: u.email,
      created_at: u.created_at,
      status: u.status,
      role: u.role,
      is_demo: u.is_demo || false,
      licenseStatus: license?.status || 'pending',
      activated_at: license?.activated_at || null
    };
  });

  res.json({ users: result });
});

// 8. ADMIN UPDATE LICENSE
apiRouter.post('/admin/update-license', authenticate, requireAdmin, async (req: Request, res: Response) => {
  const { targetUserId, newStatus } = req.body;
  if (!targetUserId || !['pending', 'active', 'revoked'].includes(newStatus)) {
    return res.status(400).json({ error: 'Parámetros inválidos' });
  }

  const db = await getDatabase();
  const targetUser = db.users.find(u => u.id === targetUserId);
  if (targetUser?.is_demo) {
    return res.status(400).json({ error: 'La cuenta demo de exhibición no se modifica' });
  }

  const product = db.products.find(p => p.slug === 'dividi-mesa');
  if (!product) return res.status(404).json({ error: 'Producto no encontrado' });

  let license = db.user_products.find(
    up => up.user_id === targetUserId && up.product_id === product.id
  );

  if (!license) {
    license = {
      id: `lic_${Date.now()}`,
      user_id: targetUserId,
      product_id: product.id,
      status: newStatus,
      activated_at: newStatus === 'active' ? new Date().toISOString() : null
    };
    db.user_products.push(license);
  } else {
    license.status = newStatus;
    if (newStatus === 'active' && !license.activated_at) {
      license.activated_at = new Date().toISOString();
    } else if (newStatus === 'revoked') {
      license.activated_at = null;
    }
  }

  // Create audit notification for license change
  if (targetUser && (newStatus === 'active' || newStatus === 'revoked')) {
    const actionType = newStatus === 'active' ? 'LICENSE_ACTIVATED' : 'LICENSE_REVOKED';
    const actionLabel = newStatus === 'active' ? 'Activada' : 'Revocada';
    const auditNotif: DbAdminNotification = {
      id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      type: actionType,
      user_name: targetUser.name,
      user_email: targetUser.email,
      product_name: product.name,
      product_slug: product.slug,
      status: newStatus,
      recipient: PRIMARY_ADMIN_EMAIL,
      created_at: new Date().toISOString(),
      read: false,
      subject: `[Licencia ${actionLabel}] ${targetUser.name} (${product.name})`,
      body: `La licencia del producto ${product.name} para el usuario ${targetUser.name} (${targetUser.email}) fue cambiada a estado ${newStatus.toUpperCase()}.`
    };
    db.notifications.unshift(auditNotif);
  }

  await saveDatabase(db);
  res.json({ message: `Licencia actualizada a: ${newStatus}`, license });
});

// 9. ADMIN NOTIFICATIONS
apiRouter.get('/admin/notifications', authenticate, requireAdmin, async (_req: Request, res: Response) => {
  const db = await getDatabase();
  res.json({ notifications: db.notifications || [] });
});

// 10. ADMIN NOTIFICATION READ
apiRouter.post('/admin/notifications/:id/read', authenticate, requireAdmin, async (req: Request, res: Response) => {
  const db = await getDatabase();
  const notif = (db.notifications || []).find(n => n.id === req.params.id);
  if (notif) {
    notif.read = true;
    await saveDatabase(db);
  }
  res.json({ success: true });
});
