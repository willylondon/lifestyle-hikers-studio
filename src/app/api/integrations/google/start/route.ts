import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth-server';
import { buildGoogleAuthUrl, googleOAuthConfigured } from '@/lib/google-drive';
import { randomBytes } from 'node:crypto';

export async function GET() {
  try {
    await requireSession();
    if (!googleOAuthConfigured()) return NextResponse.json({ error: 'Google OAuth is not configured.' }, { status: 503 });
    const state = randomBytes(24).toString('hex');
    const res = NextResponse.redirect(buildGoogleAuthUrl(state));
    res.cookies.set('lh_google_oauth_state', state, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 600 });
    return res;
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 401 });
  }
}
