import { config } from './config';
import { getGoogleConnection, saveGoogleConnection } from './google-repo';

export interface DriveFileItem {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  thumbnailLink?: string;
  modifiedTime?: string;
}

export function googleOAuthConfigured(): boolean {
  return Boolean(config.google.clientId && config.google.clientSecret && config.google.redirectUri);
}

export function buildGoogleAuthUrl(state: string): string {
  const u = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  u.searchParams.set('client_id', config.google.clientId);
  u.searchParams.set('redirect_uri', config.google.redirectUri);
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('scope', 'https://www.googleapis.com/auth/drive.readonly');
  u.searchParams.set('access_type', 'offline');
  u.searchParams.set('include_granted_scopes', 'true');
  u.searchParams.set('prompt', 'consent');
  u.searchParams.set('state', state);
  return u.toString();
}

export async function exchangeGoogleCode(code: string): Promise<{ accessToken: string; refreshToken?: string; expiresAt: string; scope?: string }> {
  const body = new URLSearchParams({
    code,
    client_id: config.google.clientId,
    client_secret: config.google.clientSecret,
    redirect_uri: config.google.redirectUri,
    grant_type: 'authorization_code',
  });
  const res = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
  if (!res.ok) throw new Error(`Google token exchange failed: ${await res.text()}`);
  const data = await res.json() as { access_token: string; refresh_token?: string; expires_in: number; scope?: string };
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000).toISOString(),
    scope: data.scope,
  };
}

async function refreshAccessToken(userId: string, refreshToken: string): Promise<string> {
  const body = new URLSearchParams({
    refresh_token: refreshToken,
    client_id: config.google.clientId,
    client_secret: config.google.clientSecret,
    grant_type: 'refresh_token',
  });
  const res = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
  if (!res.ok) throw new Error(`Google token refresh failed: ${await res.text()}`);
  const data = await res.json() as { access_token: string; expires_in: number; scope?: string };
  const expiresAt = new Date(Date.now() + data.expires_in * 1000).toISOString();
  await saveGoogleConnection(userId, { accessToken: data.access_token, refreshToken, expiresAt, scope: data.scope });
  return data.access_token;
}

export async function getGoogleAccessToken(userId: string): Promise<string> {
  const conn = await getGoogleConnection(userId);
  if (!conn) throw new Error('GOOGLE_DRIVE_NOT_CONNECTED');
  const expires = conn.expiresAt ? new Date(conn.expiresAt).getTime() : 0;
  if (!expires || expires > Date.now() + 60_000) return conn.accessToken;
  if (!conn.refreshToken) throw new Error('GOOGLE_DRIVE_RECONNECT_REQUIRED');
  return refreshAccessToken(userId, conn.refreshToken);
}

export async function listDriveFolder(userId: string, folderId = 'root'): Promise<DriveFileItem[]> {
  const token = await getGoogleAccessToken(userId);
  const q = `'${folderId.replace(/'/g, "\\'")}' in parents and trashed = false`;
  const fields = 'files(id,name,mimeType,size,thumbnailLink,modifiedTime)';
  const u = new URL('https://www.googleapis.com/drive/v3/files');
  u.searchParams.set('q', q);
  u.searchParams.set('fields', fields);
  u.searchParams.set('pageSize', '200');
  u.searchParams.set('orderBy', 'folder,name_natural');
  const res = await fetch(u, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
  if (!res.ok) throw new Error(`Google Drive list failed: ${await res.text()}`);
  const data = await res.json() as { files: DriveFileItem[] };
  return data.files;
}

export async function downloadDriveFile(userId: string, fileId: string): Promise<{ filename: string; mimeType: string; buffer: Buffer }> {
  const token = await getGoogleAccessToken(userId);
  const metaRes = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=id,name,mimeType,size`, {
    headers: { Authorization: `Bearer ${token}` }, cache: 'no-store',
  });
  if (!metaRes.ok) throw new Error(`Google Drive metadata failed: ${await metaRes.text()}`);
  const meta = await metaRes.json() as DriveFileItem;
  if (meta.mimeType === 'application/vnd.google-apps.folder') throw new Error('Folders cannot be imported as media.');
  if (!meta.mimeType.startsWith('image/') && !meta.mimeType.startsWith('video/')) throw new Error(`Unsupported Drive file type: ${meta.mimeType}`);
  const dataRes = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` }, cache: 'no-store',
  });
  if (!dataRes.ok) throw new Error(`Google Drive download failed: ${await dataRes.text()}`);
  return { filename: meta.name, mimeType: meta.mimeType, buffer: Buffer.from(await dataRes.arrayBuffer()) };
}
