import { config } from './config';

const OAUTH_AUTHORIZE = 'https://www.instagram.com/oauth/authorize';
const OAUTH_TOKEN = 'https://api.instagram.com/oauth/access_token';
export const INSTAGRAM_OAUTH_SCOPE = 'instagram_business_basic,instagram_business_content_publish';

export interface InstagramProfile {
  id: string;
  userId: string;
  username: string;
  accountType: string;
}

const PROFESSIONAL_ACCOUNT_TYPES = new Set(['BUSINESS', 'CREATOR', 'MEDIA_CREATOR']);

function graphUrl(path: string): string {
  return `https://graph.instagram.com/${config.meta.graphVersion}/${path.replace(/^\//, '')}`;
}

export function instagramConfigured(): boolean {
  const sessionSecret = process.env.SESSION_SECRET || '';
  if (!config.meta.appId || !config.meta.appSecret || !config.meta.redirectUri || sessionSecret.length < 32) return false;
  try {
    return new URL(config.meta.redirectUri).pathname === '/api/integrations/instagram/callback';
  } catch {
    return false;
  }
}

function normalizeUsername(value: string): string {
  return value.trim().replace(/^@/, '').toLowerCase();
}

export function validateInstagramProfile(
  profile: Pick<InstagramProfile, 'userId' | 'username' | 'accountType'>,
  expected: { username?: string; accountId?: string } = {},
): void {
  const expectedUsername = normalizeUsername(expected.username ?? config.meta.instagramUsername);
  const expectedAccountId = (expected.accountId ?? config.meta.instagramAccountId).trim();
  if (!profile.userId || !profile.username) throw new Error('Meta did not return a complete Instagram profile.');
  if (normalizeUsername(profile.username) !== expectedUsername) {
    throw new Error(`Only @${expectedUsername} can be connected to this app.`);
  }
  if (expectedAccountId && profile.userId !== expectedAccountId) {
    throw new Error(`The authorized profile is not the configured @${expectedUsername} account.`);
  }
  if (!PROFESSIONAL_ACCOUNT_TYPES.has(profile.accountType.trim().toUpperCase())) {
    throw new Error(`@${expectedUsername} must be an Instagram Business or Creator account.`);
  }
}

export function isExpectedInstagramConnection(input: {
  instagramAccountId: string;
  username: string;
  accountType: string;
}): boolean {
  try {
    validateInstagramProfile({
      userId: input.instagramAccountId,
      username: input.username,
      accountType: input.accountType,
    });
    return true;
  } catch {
    return false;
  }
}

export function buildInstagramAuthorizeUrl(state: string): string {
  if (!instagramConfigured()) throw new Error('Instagram integration is not configured.');
  const params = new URLSearchParams({
    client_id: config.meta.appId,
    redirect_uri: config.meta.redirectUri,
    response_type: 'code',
    scope: INSTAGRAM_OAUTH_SCOPE,
    state,
    force_reauth: 'true',
  });
  return `${OAUTH_AUTHORIZE}?${params}`;
}

export async function exchangeInstagramCode(code: string): Promise<{ accessToken: string; userId: string }> {
  const form = new URLSearchParams({
    client_id: config.meta.appId,
    client_secret: config.meta.appSecret,
    grant_type: 'authorization_code',
    redirect_uri: config.meta.redirectUri,
    code,
  });
  const res = await fetch(OAUTH_TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form,
    cache: 'no-store',
  });
  if (!res.ok) throw await instagramApiError(res, 'Instagram authorization failed');
  const data = await res.json() as { access_token: string; user_id: string | number };
  if (!data.access_token || !data.user_id) throw new Error('Instagram authorization returned an incomplete token response.');
  return { accessToken: data.access_token, userId: String(data.user_id) };
}

export async function exchangeForLongLivedToken(accessToken: string): Promise<{ accessToken: string; expiresIn: number }> {
  const params = new URLSearchParams({
    grant_type: 'ig_exchange_token',
    client_secret: config.meta.appSecret,
    access_token: accessToken,
  });
  const res = await fetch(`https://graph.instagram.com/access_token?${params}`, { cache: 'no-store' });
  if (!res.ok) throw await instagramApiError(res, 'Instagram long-lived token exchange failed');
  const data = await res.json() as { access_token: string; expires_in?: number };
  if (!data.access_token) throw new Error('Instagram long-lived token exchange returned no access token.');
  return { accessToken: data.access_token, expiresIn: data.expires_in || 5184000 };
}

export async function getInstagramProfile(accessToken: string): Promise<InstagramProfile> {
  const params = new URLSearchParams({ fields: 'id,user_id,username,account_type', access_token: accessToken });
  const res = await fetch(`https://graph.instagram.com/me?${params}`, { cache: 'no-store' });
  if (!res.ok) throw await instagramApiError(res, 'Could not read Instagram profile');
  const data = await res.json() as Record<string, string | number | undefined>;
  return {
    id: String(data.id || data.user_id || ''),
    userId: String(data.user_id || data.id || ''),
    username: String(data.username || ''),
    accountType: String(data.account_type || ''),
  };
}

async function instagramApiError(res: Response, prefix: string): Promise<Error> {
  let detail = '';
  let code: string | number | undefined;
  try {
    const body = await res.json() as {
      error?: { message?: string; code?: string | number; error_subcode?: string | number };
      error_message?: string;
      code?: string | number;
    };
    detail = body.error?.message || body.error_message || '';
    code = body.error?.error_subcode || body.error?.code || body.code;
  } catch {
    // Do not include raw response bodies; OAuth responses must never echo credentials.
  }
  const suffix = detail || `HTTP ${res.status}`;
  return new Error(`${prefix}${code ? ` (code ${code})` : ''}: ${suffix}`);
}

export async function assertMetaCanFetchImage(imageUrl: string): Promise<void> {
  let parsed: URL;
  try {
    parsed = new URL(imageUrl);
  } catch {
    throw new Error('The rendered slide URL is invalid.');
  }
  if (parsed.protocol !== 'https:') {
    throw new Error('Instagram publishing requires an HTTPS media URL that Meta can fetch.');
  }
  const res = await fetch(imageUrl, {
    method: 'GET',
    headers: { Range: 'bytes=0-0' },
    cache: 'no-store',
  });
  await res.body?.cancel();
  if (!res.ok) throw new Error(`Meta media URL preflight failed with HTTP ${res.status}.`);
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.toLowerCase().startsWith('image/')) {
    throw new Error('The signed media URL did not return an image.');
  }
}

async function postGraph(path: string, values: Record<string, string>): Promise<Record<string, unknown>> {
  const form = new URLSearchParams(values);
  const res = await fetch(graphUrl(path), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form,
    cache: 'no-store',
  });
  if (!res.ok) throw await instagramApiError(res, 'Instagram API request failed');
  return await res.json() as Record<string, unknown>;
}

async function getGraph(path: string, accessToken: string): Promise<Record<string, unknown>> {
  const params = new URLSearchParams({ fields: 'status_code,status', access_token: accessToken });
  const res = await fetch(`${graphUrl(path)}?${params}`, { cache: 'no-store' });
  if (!res.ok) throw await instagramApiError(res, 'Instagram container status check failed');
  return await res.json() as Record<string, unknown>;
}

export async function waitForContainerReady(
  containerId: string,
  accessToken: string,
  options: { attempts?: number; intervalMs?: number } = {},
): Promise<void> {
  const attempts = options.attempts ?? 20;
  const intervalMs = options.intervalMs ?? 1500;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const data = await getGraph(containerId, accessToken);
    const statusCode = String(data.status_code || '').toUpperCase();
    if (statusCode === 'FINISHED' || statusCode === 'PUBLISHED') return;
    if (statusCode === 'ERROR' || statusCode === 'EXPIRED') {
      const status = String(data.status || 'Meta could not process the media container.');
      throw new Error(`Instagram container ${statusCode.toLowerCase()}: ${status}`);
    }
    if (attempt < attempts - 1) await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error('Instagram media processing timed out before the container was ready.');
}

export async function createImageContainer(input: {
  igUserId: string;
  imageUrl: string;
  accessToken: string;
  caption?: string;
  carouselItem?: boolean;
}): Promise<string> {
  const values: Record<string, string> = {
    image_url: input.imageUrl,
    access_token: input.accessToken,
  };
  if (input.caption) values.caption = input.caption;
  if (input.carouselItem) values.is_carousel_item = 'true';
  const data = await postGraph(`${input.igUserId}/media`, values);
  if (!data.id) throw new Error('Instagram did not return a media container ID.');
  return String(data.id);
}

export async function createCarouselContainer(input: {
  igUserId: string;
  children: string[];
  caption: string;
  accessToken: string;
}): Promise<string> {
  const data = await postGraph(`${input.igUserId}/media`, {
    media_type: 'CAROUSEL',
    children: input.children.join(','),
    caption: input.caption,
    access_token: input.accessToken,
  });
  if (!data.id) throw new Error('Instagram did not return a carousel container ID.');
  return String(data.id);
}

export async function publishContainer(input: { igUserId: string; creationId: string; accessToken: string }): Promise<string> {
  const data = await postGraph(`${input.igUserId}/media_publish`, {
    creation_id: input.creationId,
    access_token: input.accessToken,
  });
  if (!data.id) throw new Error('Instagram did not return a published media ID.');
  return String(data.id);
}
