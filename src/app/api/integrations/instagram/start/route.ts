import { NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { requireSession } from '@/lib/auth-server';
import { buildInstagramAuthorizeUrl, instagramConfigured } from '@/lib/instagram';

export async function GET() {
  try {
    await requireSession();
    if (!instagramConfigured()) return NextResponse.json({ error: 'Instagram OAuth is not configured.' }, { status: 503 });
    const state = randomBytes(24).toString('hex');
    const res = NextResponse.redirect(buildInstagramAuthorizeUrl(state));
    res.cookies.set('lh_instagram_oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 600,
    });
    return res;
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 401 });
  }
}
