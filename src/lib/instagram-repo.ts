import { getDb } from './db';
import { decryptToken, encryptToken } from './crypto';
import { isSupabaseEnabled, supabaseDelete, supabaseInsert, supabaseSelect } from './supabase';
import { newId, nowIso } from './ids';

export interface InstagramConnection {
  id: string;
  userId: string;
  accessToken: string;
  instagramAccountId: string;
  username: string;
  accountType: string;
  expiresAt: string | null;
  scope: string;
  createdAt: string;
  updatedAt: string;
}

interface Row {
  id: string;
  user_id: string;
  access_token_enc: string;
  instagram_account_id: string | null;
  username: string | null;
  account_type?: string | null;
  expires_at?: string | null;
  scope?: string | null;
  created_at: string;
  updated_at?: string | null;
}

function mapRow(row: Row): InstagramConnection {
  return {
    id: row.id,
    userId: row.user_id,
    accessToken: decryptToken(row.access_token_enc),
    instagramAccountId: row.instagram_account_id || '',
    username: row.username || '',
    accountType: row.account_type || '',
    expiresAt: row.expires_at || null,
    scope: row.scope || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at || row.created_at,
  };
}

export async function getInstagramConnection(userId: string): Promise<InstagramConnection | null> {
  if (isSupabaseEnabled()) {
    const rows = await supabaseSelect<Row>('instagram_connections', `user_id=eq.${encodeURIComponent(userId)}&limit=1`);
    return rows[0] ? mapRow(rows[0]) : null;
  }
  const row = getDb().prepare('SELECT * FROM instagram_connections WHERE user_id = ? ORDER BY created_at DESC LIMIT 1').get(userId) as Row | undefined;
  return row ? mapRow(row) : null;
}

export async function saveInstagramConnection(input: {
  userId: string;
  accessToken: string;
  instagramAccountId: string;
  username: string;
  accountType?: string;
  expiresAt?: string | null;
  scope?: string;
}): Promise<void> {
  const existing = await getInstagramConnection(input.userId);
  const now = nowIso();
  const id = existing?.id || newId('igc');
  const accessTokenEnc = encryptToken(input.accessToken);

  if (isSupabaseEnabled()) {
    await supabaseInsert('instagram_connections', {
      id,
      user_id: input.userId,
      access_token_enc: accessTokenEnc,
      instagram_account_id: input.instagramAccountId,
      username: input.username,
      account_type: input.accountType || '',
      expires_at: input.expiresAt || null,
      scope: input.scope || '',
      created_at: existing?.createdAt || now,
      updated_at: now,
    }, 'user_id');
    return;
  }

  const db = getDb();
  if (existing) {
    db.prepare(`UPDATE instagram_connections
      SET access_token_enc=?, instagram_account_id=?, username=?, account_type=?, expires_at=?, scope=?, updated_at=?
      WHERE user_id=?`).run(accessTokenEnc, input.instagramAccountId, input.username, input.accountType || '', input.expiresAt || null, input.scope || '', now, input.userId);
  } else {
    db.prepare(`INSERT INTO instagram_connections
      (id,user_id,access_token_enc,instagram_account_id,username,account_type,expires_at,scope,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?)`).run(id, input.userId, accessTokenEnc, input.instagramAccountId, input.username, input.accountType || '', input.expiresAt || null, input.scope || '', now, now);
  }
}

export async function deleteInstagramConnection(userId: string): Promise<void> {
  if (isSupabaseEnabled()) {
    await supabaseDelete('instagram_connections', `user_id=eq.${encodeURIComponent(userId)}`);
    return;
  }
  getDb().prepare('DELETE FROM instagram_connections WHERE user_id = ?').run(userId);
}
