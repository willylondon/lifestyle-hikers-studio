import { getDb } from './db';
import { isSupabaseEnabled, supabaseInsert, supabaseSelect } from './supabase';

export interface UserRow {
  id: string;
  email: string;
  name: string;
  password_hash: string;
  created_at?: string;
}

export async function findUserByEmail(email: string): Promise<UserRow | null> {
  if (isSupabaseEnabled()) {
    const rows = await supabaseSelect<UserRow>('users', `email=eq.${encodeURIComponent(email)}&limit=1`);
    return rows[0] ?? null;
  }
  const row = getDb().prepare('SELECT * FROM users WHERE email = ?').get(email) as UserRow | undefined;
  return row ?? null;
}

export async function findUserById(id: string): Promise<Pick<UserRow, 'id' | 'email' | 'name'> | null> {
  if (isSupabaseEnabled()) {
    const rows = await supabaseSelect<Pick<UserRow, 'id' | 'email' | 'name'>>('users', `select=id,email,name&id=eq.${encodeURIComponent(id)}&limit=1`);
    return rows[0] ?? null;
  }
  const row = getDb().prepare('SELECT id, email, name FROM users WHERE id = ?').get(id) as Pick<UserRow, 'id' | 'email' | 'name'> | undefined;
  return row ?? null;
}

export async function createUser(user: UserRow): Promise<void> {
  if (isSupabaseEnabled()) {
    await supabaseInsert('users', { ...user });
    return;
  }
  getDb().prepare('INSERT INTO users (id, email, name, password_hash, created_at) VALUES (?, ?, ?, ?, ?)').run(
    user.id,
    user.email,
    user.name,
    user.password_hash,
    user.created_at ?? new Date().toISOString(),
  );
}
