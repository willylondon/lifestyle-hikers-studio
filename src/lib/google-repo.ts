import { getDb } from './db';
import { isSupabaseEnabled, supabaseInsert, supabaseSelect } from './supabase';
import { newId, nowIso } from './ids';
import { decryptToken, encryptToken } from './crypto';

interface GoogleConnectionRow {
  id: string;
  user_id: string;
  access_token_enc: string;
  refresh_token_enc: string | null;
  expires_at: string | null;
  scope: string | null;
  created_at: string;
  updated_at: string;
}

export interface GoogleConnection {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: string | null;
  scope: string | null;
}

export async function getGoogleConnection(userId: string): Promise<GoogleConnection | null> {
  let row: GoogleConnectionRow | undefined;
  if (isSupabaseEnabled()) {
    const rows = await supabaseSelect<GoogleConnectionRow>('google_connections', `user_id=eq.${encodeURIComponent(userId)}&limit=1`);
    row = rows[0];
  } else {
    row = getDb().prepare('SELECT * FROM google_connections WHERE user_id = ?').get(userId) as GoogleConnectionRow | undefined;
  }
  if (!row) return null;
  return {
    accessToken: decryptToken(row.access_token_enc),
    refreshToken: row.refresh_token_enc ? decryptToken(row.refresh_token_enc) : null,
    expiresAt: row.expires_at,
    scope: row.scope,
  };
}

export async function saveGoogleConnection(userId: string, data: { accessToken: string; refreshToken?: string | null; expiresAt?: string | null; scope?: string | null }): Promise<void> {
  const existing = await getRaw(userId);
  const now = nowIso();
  const row: GoogleConnectionRow = {
    id: existing?.id ?? newId('gcon'),
    user_id: userId,
    access_token_enc: encryptToken(data.accessToken),
    refresh_token_enc: data.refreshToken ? encryptToken(data.refreshToken) : existing?.refresh_token_enc ?? null,
    expires_at: data.expiresAt ?? null,
    scope: data.scope ?? null,
    created_at: existing?.created_at ?? now,
    updated_at: now,
  };
  if (isSupabaseEnabled()) {
    await supabaseInsert('google_connections', row as unknown as Record<string, unknown>, 'user_id');
    return;
  }
  getDb().prepare(`
    INSERT INTO google_connections (id, user_id, access_token_enc, refresh_token_enc, expires_at, scope, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET access_token_enc=excluded.access_token_enc, refresh_token_enc=excluded.refresh_token_enc,
      expires_at=excluded.expires_at, scope=excluded.scope, updated_at=excluded.updated_at
  `).run(row.id, row.user_id, row.access_token_enc, row.refresh_token_enc, row.expires_at, row.scope, row.created_at, row.updated_at);
}

async function getRaw(userId: string): Promise<GoogleConnectionRow | null> {
  if (isSupabaseEnabled()) {
    const rows = await supabaseSelect<GoogleConnectionRow>('google_connections', `user_id=eq.${encodeURIComponent(userId)}&limit=1`);
    return rows[0] ?? null;
  }
  return (getDb().prepare('SELECT * FROM google_connections WHERE user_id = ?').get(userId) as GoogleConnectionRow | undefined) ?? null;
}
