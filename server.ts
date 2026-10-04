import express from 'express';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { apiRouter } from './src/server/api.ts';

dotenv.config();

const rootDir = process.cwd();
const PORT = process.env.PORT || 3000;

const app = express();
app.use(express.json());

// Mount the API Router
app.use('/api', apiRouter);

// Standalone Server Integration (Dev & Cloud Run)
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production' || fs.existsSync(path.join(rootDir, 'dist'));

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(rootDir, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(rootDir, 'dist', 'index.html'));
    });
  }

  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

const isMainModule = Boolean(
  process.argv[1] &&
  path.resolve(process.argv[1]).includes('server')
);

if (isMainModule && !process.env.NETLIFY && !process.env.AWS_LAMBDA_FUNCTION_NAME) {
  startServer().catch(err => {
    console.error('Failed to start server:', err);
  });
}

export { app };
