import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { requireSession } from '@/lib/auth-server';
import { config } from '@/lib/config';
import { exchangeForLongLivedToken, exchangeInstagramCode, getInstagramProfile, INSTAGRAM_OAUTH_SCOPE, validateInstagramProfile } from '@/lib/instagram';
import { saveInstagramConnection } from '@/lib/instagram-repo';

function clearOAuthState(response: NextResponse): NextResponse {
  response.cookies.delete('lh_instagram_oauth_state');
  return response;
}

export async function GET(req: Request) {
  try {
    const session = await requireSession();
    const url = new URL(req.url);
    const error = url.searchParams.get('error');
    const errorDescription = url.searchParams.get('error_description');
    if (error) {
      return clearOAuthState(NextResponse.redirect(`${config.appUrl}/settings?instagram=error&message=${encodeURIComponent(errorDescription || error)}`));
    }

    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const jar = await cookies();
    const expected = jar.get('lh_instagram_oauth_state')?.value;
    if (!code || !state || !expected || state !== expected) {
      return clearOAuthState(NextResponse.json({ error: 'Invalid Instagram OAuth state.' }, { status: 400 }));
    }

    const short = await exchangeInstagramCode(code);
    const long = await exchangeForLongLivedToken(short.accessToken);
    const profile = await getInstagramProfile(long.accessToken);
    validateInstagramProfile(profile);
    const expiresAt = new Date(Date.now() + long.expiresIn * 1000).toISOString();

    await saveInstagramConnection({
      userId: session.userId,
      accessToken: long.accessToken,
      instagramAccountId: profile.userId || short.userId,
      username: profile.username,
      accountType: profile.accountType,
      expiresAt,
      scope: INSTAGRAM_OAUTH_SCOPE,
    });

    return clearOAuthState(NextResponse.redirect(`${config.appUrl}/settings?instagram=connected`));
  } catch (e) {
    return clearOAuthState(NextResponse.redirect(`${config.appUrl}/settings?instagram=error&message=${encodeURIComponent((e as Error).message)}`));
  }
}
