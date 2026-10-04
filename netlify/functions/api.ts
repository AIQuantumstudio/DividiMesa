import express from 'express';
import serverless from 'serverless-http';
import { apiRouter } from '../../src/server/api.ts';

const app = express();

// Parse JSON bodies in Netlify Serverless Functions
app.use(express.json());

app.use((req, _res, next) => {
  if (req.url.startsWith('/.netlify/functions/api')) {
    req.url = req.url.replace('/.netlify/functions/api', '');
  }
  if (req.url.startsWith('/api')) {
    req.url = req.url.replace('/api', '');
  }
  if (!req.url.startsWith('/')) {
    req.url = '/' + req.url;
  }
  next();
});

app.use(apiRouter);

export const handler = serverless(app);
