import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth-server';
import { instagramConfigured, isExpectedInstagramConnection } from '@/lib/instagram';
import { getInstagramConnection } from '@/lib/instagram-repo';

export async function GET() {
  try {
    const session = await requireSession();
    const connection = await getInstagramConnection(session.userId);
    const connected = Boolean(
      connection?.accessToken &&
      connection.instagramAccountId &&
      isExpectedInstagramConnection(connection),
    );
    return NextResponse.json({
      configured: instagramConfigured(),
      connected,
      username: connected ? connection?.username : '',
      accountType: connected ? connection?.accountType : '',
      expiresAt: connected ? connection?.expiresAt : null,
    });
  } catch {
    return NextResponse.json({ configured: instagramConfigured(), connected: false });
  }
}
