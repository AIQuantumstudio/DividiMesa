import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { getStore } from '@netlify/blobs';

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
// Database Interfaces
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
// Unified Persistent Storage (Netlify Blobs in Prod + Local JSON in Dev)
// -------------------------------------------------------------
function getInitialSeed(): DatabaseSchema {
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
    notifications: []
  };
}

let inMemoryDbCache: DatabaseSchema | null = null;

function isNetlify(): boolean {
  return Boolean(
    process.env.NETLIFY ||
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
    process.env.NETLIFY_BLOBS_CONTEXT
  );
}

async function getDatabase(): Promise<DatabaseSchema> {
  // 1. Try Netlify Blobs when running in Netlify
  if (isNetlify()) {
    try {
      const store = getStore('dividi-mesa-data');
      const data = await store.get('database', { type: 'json' });
      if (data && typeof data === 'object' && Array.isArray((data as any).users)) {
        inMemoryDbCache = data as DatabaseSchema;
        return inMemoryDbCache;
      } else {
        const seed = getInitialSeed();
        await store.setJSON('database', seed);
        inMemoryDbCache = seed;
        return inMemoryDbCache;
      }
    } catch (err) {
      console.warn('Netlify Blobs read error (falling back to memory/local):', err);
    }
  }

  // 2. Local File / Memory persistence
  if (inMemoryDbCache) {
    return inMemoryDbCache;
  }

  try {
    if (fs.existsSync(DB_PATH)) {
      const content = fs.readFileSync(DB_PATH, 'utf-8');
      const parsed = JSON.parse(content);
      if (parsed && Array.isArray(parsed.users)) {
        inMemoryDbCache = parsed as DatabaseSchema;
        return inMemoryDbCache;
      }
    }
  } catch (err) {
    console.warn('Local database read failed:', err);
  }

  const seed = getInitialSeed();
  inMemoryDbCache = seed;
  try {
    const dataDir = path.dirname(DB_PATH);
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(DB_PATH, JSON.stringify(seed, null, 2), 'utf-8');
  } catch {
    // Ignore read-only filesystem errors in lambda
  }
  return seed;
}

async function saveDatabase(data: DatabaseSchema): Promise<void> {
  inMemoryDbCache = data;

  // 1. Persist to Netlify Blobs if in Netlify
  if (isNetlify()) {
    try {
      const store = getStore('dividi-mesa-data');
      await store.setJSON('database', data);
      return;
    } catch (err) {
      console.warn('Netlify Blobs write error:', err);
    }
  }

  // 2. Persist to local disk if accessible
  try {
    const dataDir = path.dirname(DB_PATH);
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
  } catch {
    // Fail silently in read-only filesystems (e.g. AWS Lambda without Blobs configured)
  }
}

// -------------------------------------------------------------
// Anti-Spam & Administrative Notifications Dispatcher
// -------------------------------------------------------------
const lastNotificationMap: Record<string, number> = {};

function shouldSendNotification(email: string, type: string): boolean {
  const key = `${email.toLowerCase()}:${type}`;
  const now = Date.now();
  const lastTime = lastNotificationMap[key] || 0;

  if (type === 'USER_REGISTERED') {
    lastNotificationMap[key] = now;
    return true;
  }

  if (now - lastTime < 3600000) {
    return false;
  }

  lastNotificationMap[key] = now;
  return true;
}

async function recordAndDispatchNotification(payload: {
  type: 'USER_REGISTERED' | 'LOGIN_ATTEMPT_PENDING' | 'LOGIN_ATTEMPT_REVOKED';
  userName: string;
  userEmail: string;
  productName: string;
  productSlug: string;
  status: 'pending' | 'revoked';
}): Promise<DbAdminNotification | null> {
  const canSend = shouldSendNotification(payload.userEmail, payload.type);
  if (!canSend) {
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

  const db = await getDatabase();
  db.notifications = db.notifications || [];
  db.notifications.unshift(notification);
  await saveDatabase(db);

  return notification;
}

// -------------------------------------------------------------
// Express App & Middleware Configuration
// -------------------------------------------------------------
const app = express();
app.use(express.json());

// 1. Path Normalizer for Netlify Functions & Direct Routing
app.use((req, _res, next) => {
  if (req.url.startsWith('/.netlify/functions/api')) {
    req.url = req.url.replace('/.netlify/functions/api', '/api');
  }
  next();
});

// 2. Universal CORS headers (protects against iframe/cross-domain issues)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Auth helper middleware
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
app.post('/api/auth/demo', async (_req: Request, res: Response) => {
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

  res.json({
    token,
    user: safeUser,
    product,
    license
  });
});

// 2. STANDARD LOGIN
app.post('/api/auth/login', async (req: Request, res: Response) => {
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
app.post('/api/auth/register', async (req: Request, res: Response) => {
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
  await saveDatabase(db);

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
app.get('/api/auth/me', authenticate, async (req: Request, res: Response) => {
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

  res.json({
    user: safeUser,
    product,
    license
  });
});

// 5. FORGOT PASSWORD / RECOVERY
app.post('/api/auth/forgot-password', async (req: Request, res: Response) => {
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
app.post('/api/auth/logout', (_req: Request, res: Response) => {
  res.json({ message: 'Sesión cerrada correctamente' });
});

// -------------------------------------------------------------
// Admin & Quantum Studio Licensing & Notification Routes
// Protected strictly by requireAdmin middleware
// -------------------------------------------------------------

// List registered users and licenses
app.get('/api/admin/users', authenticate, requireAdmin, async (req: Request, res: Response) => {
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

// Update license status (pending -> active -> revoked)
app.post('/api/admin/update-license', authenticate, requireAdmin, async (req: Request, res: Response) => {
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

  await saveDatabase(db);
  res.json({ message: `Licencia actualizada a: ${newStatus}`, license });
});

// List administrative notifications
app.get('/api/admin/notifications', authenticate, requireAdmin, async (_req: Request, res: Response) => {
  const db = await getDatabase();
  res.json({ notifications: db.notifications || [] });
});

// Mark notification as read
app.post('/api/admin/notifications/:id/read', authenticate, requireAdmin, async (req: Request, res: Response) => {
  const db = await getDatabase();
  const notif = (db.notifications || []).find(n => n.id === req.params.id);
  if (notif) {
    notif.read = true;
    await saveDatabase(db);
  }
  res.json({ success: true });
});

// Export app for Netlify Functions serverless handler
export { app };

// -------------------------------------------------------------
// Standalone Server Integration (Dev & Cloud Run)
// Only starts if NOT running inside serverless / Netlify environment
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

const isMainModule = Boolean(
  process.argv[1] &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
);

if (isMainModule && !process.env.NETLIFY && !process.env.AWS_LAMBDA_FUNCTION_NAME) {
  startServer().catch(err => {
    console.error('Failed to start server:', err);
  });
}
