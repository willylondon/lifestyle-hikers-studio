import { config } from './config';

type Json = Record<string, unknown> | Array<unknown> | null;

function baseHeaders(extra: Record<string, string> = {}): Record<string, string> {
  if (!config.supabase.url || !config.supabase.serviceRoleKey) {
    throw new Error('Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  }
  const headers: Record<string, string> = {
    apikey: config.supabase.serviceRoleKey,
    ...extra,
  };

  // Modern Supabase secret keys are opaque, not JWTs. Sending one as a
  // Bearer token makes the API reject it as an invalid JWT. Legacy
  // service_role JWTs still require both headers for compatibility.
  if (!config.supabase.serviceRoleKey.startsWith('sb_secret_')) {
    headers.Authorization = `Bearer ${config.supabase.serviceRoleKey}`;
  }

  return headers;
}

export function isSupabaseEnabled(): boolean {
  return Boolean(config.supabase.url && config.supabase.serviceRoleKey);
}

export async function supabaseSelect<T>(table: string, query = ''): Promise<T[]> {
  const url = `${config.supabase.url}/rest/v1/${table}${query ? `?${query}` : ''}`;
  const res = await fetch(url, { headers: baseHeaders({ Accept: 'application/json' }), cache: 'no-store' });
  if (!res.ok) throw new Error(`Supabase select failed (${table}): ${await res.text()}`);
  return (await res.json()) as T[];
}

export async function supabaseInsert<T extends Json>(table: string, body: T, onConflict?: string): Promise<void> {
  const suffix = onConflict ? `?on_conflict=${encodeURIComponent(onConflict)}` : '';
  const res = await fetch(`${config.supabase.url}/rest/v1/${table}${suffix}`, {
    method: 'POST',
    headers: baseHeaders({
      'Content-Type': 'application/json',
      Prefer: onConflict ? 'resolution=merge-duplicates,return=minimal' : 'return=minimal',
    }),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Supabase insert failed (${table}): ${await res.text()}`);
}

export async function supabasePatch<T extends Json>(table: string, query: string, body: T): Promise<void> {
  const res = await fetch(`${config.supabase.url}/rest/v1/${table}?${query}`, {
    method: 'PATCH',
    headers: baseHeaders({ 'Content-Type': 'application/json', Prefer: 'return=minimal' }),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Supabase update failed (${table}): ${await res.text()}`);
}


export async function supabaseDelete(table: string, query: string): Promise<void> {
  const res = await fetch(`${config.supabase.url}/rest/v1/${table}?${query}`, {
    method: 'DELETE',
    headers: baseHeaders({ Prefer: 'return=minimal' }),
  });
  if (!res.ok) throw new Error(`Supabase delete failed (${table}): ${await res.text()}`);
}

export async function createSignedObjectUrl(path: string, expiresIn = 3600, downloadName?: string): Promise<string> {
  const bucket = encodeURIComponent(config.supabase.bucket);
  const objectPath = encodeObjectPath(path);
  const res = await fetch(`${config.supabase.url}/storage/v1/object/sign/${bucket}/${objectPath}`, {
    method: 'POST',
    headers: baseHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ expiresIn }),
  });
  if (!res.ok) throw new Error(`Supabase signed URL failed: ${await res.text()}`);
  const data = await res.json() as { signedURL?: string; signedUrl?: string };
  const signed = data.signedURL || data.signedUrl;
  if (!signed) throw new Error('Supabase did not return a signed URL.');
  const absolute = /^https?:\/\//.test(signed)
    ? signed
    : `${config.supabase.url}/storage/v1${signed.startsWith('/') ? signed : `/${signed}`}`;
  if (!downloadName) return absolute;
  return `${absolute}${absolute.includes('?') ? '&' : '?'}download=${encodeURIComponent(downloadName)}`;
}
function encodeObjectPath(path: string): string {
  return path.split('/').map(encodeURIComponent).join('/');
}

export async function uploadObject(path: string, data: Buffer, contentType = 'application/octet-stream'): Promise<void> {
  const bucket = encodeURIComponent(config.supabase.bucket);
  const objectPath = encodeObjectPath(path);
  const res = await fetch(`${config.supabase.url}/storage/v1/object/${bucket}/${objectPath}`, {
    method: 'POST',
    headers: baseHeaders({
      'Content-Type': contentType,
      'x-upsert': 'true',
    }),
    body: new Uint8Array(data),
  });
  if (!res.ok) throw new Error(`Supabase storage upload failed: ${await res.text()}`);
}

export async function createSignedUploadUrl(path: string): Promise<string> {
  const bucket = encodeURIComponent(config.supabase.bucket);
  const objectPath = encodeObjectPath(path);
  const res = await fetch(`${config.supabase.url}/storage/v1/object/upload/sign/${bucket}/${objectPath}`, {
    method: 'POST',
    headers: baseHeaders({ 'Content-Type': 'application/json' }),
    body: '{}',
  });
  if (!res.ok) throw new Error(`Supabase signed upload URL failed: ${await res.text()}`);
  const data = await res.json() as { url?: string; signedUrl?: string };
  const signed = data.signedUrl || data.url;
  if (!signed) throw new Error('Supabase did not return a signed upload URL.');
  if (/^https?:\/\//.test(signed)) return signed;
  return `${config.supabase.url}/storage/v1${signed.startsWith('/') ? signed : `/${signed}`}`;
}

export async function deleteObjects(paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  const bucket = encodeURIComponent(config.supabase.bucket);
  const res = await fetch(`${config.supabase.url}/storage/v1/object/${bucket}`, {
    method: 'DELETE',
    headers: baseHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ prefixes: paths }),
  });
  if (!res.ok) throw new Error(`Supabase storage cleanup failed: ${await res.text()}`);
}

export interface StorageObjectEntry {
  name: string;
  id: string | null;
  created_at: string | null;
  updated_at: string | null;
  metadata: { size?: number } | null;
}

export async function listObjects(prefix = '', limit = 1000, offset = 0): Promise<StorageObjectEntry[]> {
  const bucket = encodeURIComponent(config.supabase.bucket);
  const res = await fetch(`${config.supabase.url}/storage/v1/object/list/${bucket}`, {
    method: 'POST',
    headers: baseHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      prefix,
      limit,
      offset,
      sortBy: { column: 'name', order: 'asc' },
    }),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Supabase storage listing failed: ${await res.text()}`);
  return (await res.json()) as StorageObjectEntry[];
}

export async function downloadObject(path: string): Promise<Buffer> {
  const bucket = encodeURIComponent(config.supabase.bucket);
  const objectPath = encodeObjectPath(path);
  const res = await fetch(`${config.supabase.url}/storage/v1/object/${bucket}/${objectPath}`, {
    headers: baseHeaders(),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Supabase storage download failed: ${res.status} ${await res.text()}`);
  return Buffer.from(await res.arrayBuffer());
}

export async function objectExists(path: string): Promise<boolean> {
  try {
    await downloadObject(path);
    return true;
  } catch {
    return false;
  }
}
