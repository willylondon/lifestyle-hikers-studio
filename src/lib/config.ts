import path from 'node:path';
import fs from 'node:fs';

const root = process.cwd();

export const config = {
  get dataDir() {
    return path.resolve(root, process.env.DATA_DIR || './data');
  },
  get mediaDir() {
    return path.resolve(root, process.env.MEDIA_DIR || './data/media');
  },
  get dbPath() {
    return path.join(this.dataDir, 'lifestyle-hikers.sqlite');
  },
  get sessionSecret() {
    return process.env.SESSION_SECRET || 'dev-secret-change-me';
  },
  get appUrl() {
    return (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');
  },
  ai: {
    provider: process.env.AI_PROVIDER || '',
    baseUrl: process.env.AI_BASE_URL || 'https://api.openai.com/v1',
    apiKey: process.env.AI_API_KEY || '',
    model: process.env.AI_MODEL || 'gpt-4o-mini',
  },
  supabase: {
    url: (process.env.SUPABASE_URL || '').replace(/\/$/, ''),
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    bucket: process.env.SUPABASE_STORAGE_BUCKET || 'lifestyle-hikers-media',
  },
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    redirectUri: process.env.GOOGLE_REDIRECT_URI || '',
  },
  enhancement: {
    engine: process.env.ENHANCEMENT_ENGINE || 'sharp',
    qaThreshold: Number(process.env.QA_CONFIDENCE_THRESHOLD || 0.9),
  },
  meta: {
    appId: process.env.META_APP_ID || '',
    appSecret: process.env.META_APP_SECRET || '',
    redirectUri: process.env.META_REDIRECT_URI || '',
    instagramAccountId: process.env.META_INSTAGRAM_ACCOUNT_ID || '',
    instagramUsername: process.env.META_INSTAGRAM_USERNAME || 'lifestylehikers',
    graphVersion: process.env.META_GRAPH_VERSION || 'v26.0',
  },
  limits: {
    maxUploadBytes: 25 * 1024 * 1024,
    maxFileCount: 30,
    slideWidth: 1080,
    slideHeight: 1350,
  },
};

export function ensureDirs() {
  for (const dir of [config.dataDir, config.mediaDir, config.mediaDir + '/original', config.mediaDir + '/enhanced', config.mediaDir + '/derivative', config.mediaDir + '/export']) {
    fs.mkdirSync(dir, { recursive: true });
  }
}
