import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { requireSession } from '@/lib/auth-server';
import { exchangeGoogleCode } from '@/lib/google-drive';
import { saveGoogleConnection } from '@/lib/google-repo';
import { config } from '@/lib/config';

export async function GET(req: Request) {
  const session = await requireSession();
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const jar = await cookies();
  const expected = jar.get('lh_google_oauth_state')?.value;
  if (!code || !state || !expected || state !== expected) return NextResponse.json({ error: 'Invalid Google OAuth state.' }, { status: 400 });
  const token = await exchangeGoogleCode(code);
  await saveGoogleConnection(session.userId, token);
  const res = NextResponse.redirect(`${config.appUrl}/create?google=connected`);
  res.cookies.delete('lh_google_oauth_state');
  return res;
}
