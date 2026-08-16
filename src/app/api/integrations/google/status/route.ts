import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth-server';
import { getGoogleConnection } from '@/lib/google-repo';
import { googleOAuthConfigured } from '@/lib/google-drive';

export async function GET() {
  try {
    const session = await requireSession();
    const connection = await getGoogleConnection(session.userId);
    return NextResponse.json({ configured: googleOAuthConfigured(), connected: Boolean(connection) });
  } catch {
    return NextResponse.json({ configured: false, connected: false });
  }
}
