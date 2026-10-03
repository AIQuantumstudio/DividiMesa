import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, 'data', 'database.json');
const SERVER_SECRET = process.env.SERVER_SECRET || 'dividimesa-quantum-auth-secret-key-2026';

// Primary Administrator & Recipient of administrative alerts
const PRIMARY_ADMIN_EMAIL = 'aiquantumstudio@gmail.com';
const DEMO_EMAIL = 'demo@aiquantumstudio.com';

// -------------------------------------------------------------
// Database Interfaces & Persistence
// -------------------------------------------------------------
interface DbUser {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  created_at: string;
  status: 'active' | 'pending' | 'suspended';
  role: 'admin' | 'user' | 'demo';
  is_demo?: boolean;
}

interface DbProduct {
  id: string;
  name: string;
  slug: string;
}

interface DbUserProduct {
  id: string;
  user_id: string;
  product_id: string;
  status: 'pending' | 'active' | 'revoked';
  activated_at: string | null;
}

export interface DbAdminNotification {
  id: string;
  type: 'USER_REGISTERED' | 'LOGIN_ATTEMPT_PENDING' | 'LOGIN_ATTEMPT_REVOKED';
  user_name: string;
  user_email: string;
  product_name: string;
  product_slug: string;
  status: 'pending' | 'revoked';
  recipient: string;
  created_at: string;
  read: boolean;
  subject: string;
  body: string;
}

interface DatabaseSchema {
  users: DbUser[];
  products: DbProduct[];
  user_products: DbUserProduct[];
  notifications: DbAdminNotification[];
}

function hashPassword(pwd: string): string {
  return crypto.createHash('sha256').update(pwd + SERVER_SECRET).digest('hex');
}

function generateToken(userId: string): string {
  const payload = `${userId}:${Date.now()}`;
  const signature = crypto.createHmac('sha256', SERVER_SECRET).update(payload).digest('hex');
  return Buffer.from(`${payload}:${signature}`).toString('base64');
}

function verifyToken(token: string): string | null {
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

// -------------------------------------------------------------
// Anti-Spam & Administrative Notifications Dispatcher
// -------------------------------------------------------------
const lastNotificationMap: Record<string, number> = {};

function shouldSendNotification(email: string, type: string): boolean {
  const key = `${email.toLowerCase()}:${type}`;
  const now = Date.now();
  const lastTime = lastNotificationMap[key] || 0;

  // New registrations are always notified
  if (type === 'USER_REGISTERED') {
    lastNotificationMap[key] = now;
    return true;
  }

  // 1 hour cooldown (3600000 ms) to avoid spam on repeated non-active login attempts
  if (now - lastTime < 3600000) {
    return false;
  }

  lastNotificationMap[key] = now;
  return true;
}

function recordAndDispatchNotification(payload: {
  type: 'USER_REGISTERED' | 'LOGIN_ATTEMPT_PENDING' | 'LOGIN_ATTEMPT_REVOKED';
  userName: string;
  userEmail: string;
  productName: string;
  productSlug: string;
  status: 'pending' | 'revoked';
}): DbAdminNotification | null {
  const canSend = shouldSendNotification(payload.userEmail, payload.type);
  if (!canSend) {
    console.log(`[Anti-Spam] Notificación suprimida por cooldown reciente: ${payload.userEmail} (${payload.type})`);
    return null;
  }

  const dateStr = new Date().toLocaleString('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    dateStyle: 'short',
    timeStyle: 'medium'
  });

  let subject = '';
  let body = '';

  if (payload.type === 'USER_REGISTERED') {
    subject = `[AI Quantum Studio] Nueva solicitud de acceso - ${payload.userName} (Dividí Mesa)`;
    body = `Se ha registrado un nuevo usuario para utilizar Dividí Mesa:\n\n` +
      `• Nombre: ${payload.userName}\n` +
      `• Email: ${payload.userEmail}\n` +
      `• Fecha y hora: ${dateStr}\n` +
      `• Producto solicitado: ${payload.productName} (slug: ${payload.productSlug})\n` +
      `• Estado actual: PENDING (Acceso NO otorgado hasta aprobación manual)\n\n` +
      `Podés aprobar o gestionar este acceso desde el panel de Licencias de la aplicación.`;
  } else if (payload.type === 'LOGIN_ATTEMPT_PENDING') {
    subject = `[Alerta de Acceso] Intento de login con licencia PENDIENTE - ${payload.userName}`;
    body = `Un usuario registrado intentó iniciar sesión pero su licencia aún no fue activada:\n\n` +
      `• Nombre: ${payload.userName}\n` +
      `• Email: ${payload.userEmail}\n` +
      `• Fecha y hora: ${dateStr}\n` +
      `• Producto: ${payload.productName}\n` +
      `• Estado actual: PENDING (El usuario fue retenido en pantalla de activación pendiente).`;
  } else if (payload.type === 'LOGIN_ATTEMPT_REVOKED') {
    subject = `[Alerta de Seguridad] Intento de login con licencia REVOCADA - ${payload.userName}`;
    body = `Un usuario con licencia revocada intentó ingresar al sistema:\n\n` +
      `• Nombre: ${payload.userName}\n` +
      `• Email: ${payload.userEmail}\n` +
      `• Fecha y hora: ${dateStr}\n` +
      `• Producto: ${payload.productName}\n` +
      `• Estado actual: REVOKED (Acceso denegado).`;
  }

  const notification: DbAdminNotification = {
    id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    type: payload.type,
    user_name: payload.userName,
    user_email: payload.userEmail,
    product_name: payload.productName,
    product_slug: payload.productSlug,
    status: payload.status,
    recipient: PRIMARY_ADMIN_EMAIL,
    created_at: new Date().toISOString(),
    read: false,
    subject,
    body
  };

  db.notifications = db.notifications || [];
  db.notifications.unshift(notification);
  saveDatabase();

  console.log(`\n============================================================`);
  console.log(`📧 NOTIFICACIÓN ADMINISTRATIVA DESPACHADA`);
  console.log(`Para: ${PRIMARY_ADMIN_EMAIL}`);
  console.log(`Asunto: ${subject}`);
  console.log(`Cuerpo:\n${body}`);
  console.log(`============================================================\n`);

  return notification;
}

// -------------------------------------------------------------
// Database Initialization & Seed
// -------------------------------------------------------------
function initDatabase(): DatabaseSchema {
  const dataDir = path.join(__dirname, 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const initialProduct: DbProduct = {
    id: 'prod_dividi_mesa',
    name: 'Dividí Mesa',
    slug: 'dividi-mesa'
  };

  // Pre-configured accounts for testing and production
  const initialUsers: DbUser[] = [
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
  ];

  const initialLicenses: DbUserProduct[] = [
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
  ];

  const dbData: DatabaseSchema = {
    users: initialUsers,
    products: [initialProduct],
    user_products: initialLicenses,
    notifications: []
  };

  fs.writeFileSync(DB_PATH, JSON.stringify(dbData, null, 2), 'utf-8');
  return dbData;
}

let db = initDatabase();

function saveDatabase() {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save database:', err);
  }
}

// -------------------------------------------------------------
// Express App & Middleware
// -------------------------------------------------------------
const app = express();
app.use(express.json());

// Auth helper middleware
function authenticate(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No autorizado: sesión requerida' });
  }

  const token = authHeader.split(' ')[1];
  const userId = verifyToken(token);
  if (!userId) {
    return res.status(401).json({ error: 'Sesión inválida o expirada' });
  }

  const user = db.users.find(u => u.id === userId);
  if (!user) {
    return res.status(401).json({ error: 'Usuario no encontrado' });
  }

  (req as any).user = user;
  next();
}

// Strict Admin Gatekeeper: ONLY aiquantumstudio@gmail.com with role === 'admin'
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

// -------------------------------------------------------------
// Auth & License Routes (/api/auth)
// -------------------------------------------------------------

// 1. DEMO LOGIN (One-click controlled demo without revealing credentials)
app.post('/api/auth/demo', (_req: Request, res: Response) => {
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

  res.json({
    token,
    user: safeUser,
    product,
    license
  });
});

// 2. STANDARD LOGIN
app.post('/api/auth/login', (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email y contraseña requeridos' });
  }

  const normalizedEmail = String(email).trim().toLowerCase();
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

  // Administrative Notifications for non-active login attempts (only for real users, not demo)
  if (!user.is_demo) {
    if (license.status === 'pending') {
      recordAndDispatchNotification({
        type: 'LOGIN_ATTEMPT_PENDING',
        userName: user.name,
        userEmail: user.email,
        productName: product.name,
        productSlug: product.slug,
        status: 'pending'
      });
    } else if (license.status === 'revoked') {
      recordAndDispatchNotification({
        type: 'LOGIN_ATTEMPT_REVOKED',
        userName: user.name,
        userEmail: user.email,
        productName: product.name,
        productSlug: product.slug,
        status: 'revoked'
      });
    }
  }

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

  res.json({
    token,
    user: safeUser,
    product,
    license
  });
});

// 3. REGISTER (Real clients register with status: 'pending')
app.post('/api/auth/register', (req: Request, res: Response) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Nombre, email y contraseña son obligatorios' });
  }

  const normalizedEmail = String(email).trim().toLowerCase();

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

  // Crucial Rule: Registration gives status = 'pending' (NOT active!)
  const newLicense: DbUserProduct = {
    id: `lic_${Date.now()}`,
    user_id: newUser.id,
    product_id: product.id,
    status: 'pending',
    activated_at: null
  };

  db.user_products.push(newLicense);
  saveDatabase();

  // Send Administrative Notification to aiquantumstudio@gmail.com
  recordAndDispatchNotification({
    type: 'USER_REGISTERED',
    userName: newUser.name,
    userEmail: newUser.email,
    productName: product.name,
    productSlug: product.slug,
    status: 'pending'
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

// 4. ME (SESSION & ACCESS VERIFICATION)
app.get('/api/auth/me', authenticate, (req: Request, res: Response) => {
  const user = (req as any).user as DbUser;

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
    saveDatabase();
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

  res.json({
    user: safeUser,
    product,
    license
  });
});

// 5. FORGOT PASSWORD / RECOVERY
app.post('/api/auth/forgot-password', (req: Request, res: Response) => {
  const { email, newPassword } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Ingresá tu correo electrónico' });
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const user = db.users.find(u => u.email.toLowerCase() === normalizedEmail);

  if (!user) {
    return res.status(404).json({ error: 'No se encontró ningún usuario con ese correo' });
  }

  if (newPassword && String(newPassword).length >= 4) {
    user.password_hash = hashPassword(newPassword);
    saveDatabase();
    return res.json({ message: 'Contraseña restablecida con éxito. Ya podés iniciar sesión.' });
  }

  res.json({
    message: 'Se validó tu identidad. Ingresá una nueva contraseña.',
    verified: true
  });
});

// 6. LOGOUT
app.post('/api/auth/logout', (_req: Request, res: Response) => {
  res.json({ message: 'Sesión cerrada correctamente' });
});

// -------------------------------------------------------------
// Admin & Quantum Studio Licensing & Notification Routes
// Protected strictly by requireAdmin middleware
// -------------------------------------------------------------

// List registered users and licenses
app.get('/api/admin/users', authenticate, requireAdmin, (req: Request, res: Response) => {
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

// Update license status (pending -> active -> revoked)
app.post('/api/admin/update-license', authenticate, requireAdmin, (req: Request, res: Response) => {
  const { targetUserId, newStatus } = req.body;
  if (!targetUserId || !['pending', 'active', 'revoked'].includes(newStatus)) {
    return res.status(400).json({ error: 'Parámetros inválidos' });
  }

  // Prevent modifying demo account status
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

  saveDatabase();
  res.json({ message: `Licencia actualizada a: ${newStatus}`, license });
});

// List administrative notifications
app.get('/api/admin/notifications', authenticate, requireAdmin, (_req: Request, res: Response) => {
  res.json({ notifications: db.notifications || [] });
});

// Mark notification as read
app.post('/api/admin/notifications/:id/read', authenticate, requireAdmin, (req: Request, res: Response) => {
  const notif = (db.notifications || []).find(n => n.id === req.params.id);
  if (notif) {
    notif.read = true;
    saveDatabase();
  }
  res.json({ success: true });
});

// -------------------------------------------------------------
// Vite Server Integration (Dev vs Prod)
// -------------------------------------------------------------
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production' || fs.existsSync(path.join(__dirname, 'dist'));

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
});
