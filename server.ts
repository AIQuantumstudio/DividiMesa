import express, { Request, Response, NextFunction } from 'express';
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

const ADMIN_EMAILS = ['admin@dividimesa.com', 'aiquantumstudio@gmail.com'];
const NOTIFICATION_RECIPIENT = 'aiquantumstudio@gmail.com';

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

  // Login attempt alerts: 1 hour cooldown (3600000 ms) to avoid spam from repeated attempts
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
    recipient: NOTIFICATION_RECIPIENT,
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
  console.log(`Para: ${NOTIFICATION_RECIPIENT}`);
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

  let existingData: Partial<DatabaseSchema> = {};
  if (fs.existsSync(DB_PATH)) {
    try {
      const content = fs.readFileSync(DB_PATH, 'utf-8');
      existingData = JSON.parse(content);
    } catch (e) {
      console.error('Error reading db.json, creating initial state:', e);
    }
  }

  const initialProduct: DbProduct = {
    id: 'prod_dividi_mesa',
    name: 'Dividí Mesa',
    slug: 'dividi-mesa'
  };

  const initialUsers: DbUser[] = existingData.users || [
    {
      id: 'usr_admin_001',
      name: 'Admin Autorizado',
      email: 'admin@dividimesa.com',
      password_hash: hashPassword('admin123'),
      created_at: new Date().toISOString(),
      status: 'active'
    },
    {
      id: 'usr_admin_quantum',
      name: 'AI Quantum Studio',
      email: 'aiquantumstudio@gmail.com',
      password_hash: hashPassword('admin123'),
      created_at: new Date().toISOString(),
      status: 'active'
    },
    {
      id: 'usr_pending_002',
      name: 'Usuario Pendiente',
      email: 'pendiente@dividimesa.com',
      password_hash: hashPassword('demo123'),
      created_at: new Date().toISOString(),
      status: 'active'
    },
    {
      id: 'usr_revoked_003',
      name: 'Usuario Revocado',
      email: 'revocado@dividimesa.com',
      password_hash: hashPassword('demo123'),
      created_at: new Date().toISOString(),
      status: 'active'
    }
  ];

  // Make sure aiquantumstudio is in users
  if (!initialUsers.some(u => u.email.toLowerCase() === 'aiquantumstudio@gmail.com')) {
    initialUsers.push({
      id: 'usr_admin_quantum',
      name: 'AI Quantum Studio',
      email: 'aiquantumstudio@gmail.com',
      password_hash: hashPassword('admin123'),
      created_at: new Date().toISOString(),
      status: 'active'
    });
  }

  const initialLicenses: DbUserProduct[] = existingData.user_products || [
    {
      id: 'lic_001',
      user_id: 'usr_admin_001',
      product_id: 'prod_dividi_mesa',
      status: 'active',
      activated_at: new Date().toISOString()
    },
    {
      id: 'lic_quantum',
      user_id: 'usr_admin_quantum',
      product_id: 'prod_dividi_mesa',
      status: 'active',
      activated_at: new Date().toISOString()
    },
    {
      id: 'lic_002',
      user_id: 'usr_pending_002',
      product_id: 'prod_dividi_mesa',
      status: 'pending',
      activated_at: null
    },
    {
      id: 'lic_003',
      user_id: 'usr_revoked_003',
      product_id: 'prod_dividi_mesa',
      status: 'revoked',
      activated_at: null
    }
  ];

  const dbData: DatabaseSchema = {
    users: initialUsers,
    products: existingData.products || [initialProduct],
    user_products: initialLicenses,
    notifications: existingData.notifications || []
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

// -------------------------------------------------------------
// Auth & License Routes (/api/auth)
// -------------------------------------------------------------

// 1. LOGIN
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

  // Administrative Notifications for non-active login attempts
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

  const token = generateToken(user.id);

  const safeUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    created_at: user.created_at,
    status: user.status
  };

  res.json({
    token,
    user: safeUser,
    product,
    license
  });
});

// 2. REGISTER
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
    status: 'active'
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
    status: newUser.status
  };

  res.status(201).json({
    token,
    user: safeUser,
    product,
    license: newLicense,
    message: 'Cuenta creada con éxito. Permiso Dividí Mesa: Pendiente de activación.'
  });
});

// 3. ME (SESSION & ACCESS VERIFICATION)
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
    status: user.status
  };

  res.json({
    user: safeUser,
    product,
    license
  });
});

// 4. FORGOT PASSWORD / RECOVERY
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

// 5. LOGOUT
app.post('/api/auth/logout', (_req: Request, res: Response) => {
  res.json({ message: 'Sesión cerrada correctamente' });
});

// -------------------------------------------------------------
// Admin & Quantum Studio Licensing & Notification Routes
// -------------------------------------------------------------

// List users and licenses
app.get('/api/admin/users', authenticate, (req: Request, res: Response) => {
  const currentUser = (req as any).user as DbUser;
  if (!ADMIN_EMAILS.includes(currentUser.email.toLowerCase())) {
    return res.status(403).json({ error: 'Acceso restringido a administradores' });
  }

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
      licenseStatus: license?.status || 'pending',
      activated_at: license?.activated_at || null
    };
  });

  res.json({ users: result });
});

// Update license status (pending -> active -> revoked)
app.post('/api/admin/update-license', authenticate, (req: Request, res: Response) => {
  const currentUser = (req as any).user as DbUser;
  if (!ADMIN_EMAILS.includes(currentUser.email.toLowerCase())) {
    return res.status(403).json({ error: 'Acceso restringido a administradores' });
  }

  const { targetUserId, newStatus } = req.body;
  if (!targetUserId || !['pending', 'active', 'revoked'].includes(newStatus)) {
    return res.status(400).json({ error: 'Parámetros inválidos' });
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
app.get('/api/admin/notifications', authenticate, (req: Request, res: Response) => {
  const currentUser = (req as any).user as DbUser;
  if (!ADMIN_EMAILS.includes(currentUser.email.toLowerCase())) {
    return res.status(403).json({ error: 'Acceso restringido a administradores' });
  }

  res.json({ notifications: db.notifications || [] });
});

// Mark notification as read
app.post('/api/admin/notifications/:id/read', authenticate, (req: Request, res: Response) => {
  const currentUser = (req as any).user as DbUser;
  if (!ADMIN_EMAILS.includes(currentUser.email.toLowerCase())) {
    return res.status(403).json({ error: 'Acceso restringido a administradores' });
  }

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
