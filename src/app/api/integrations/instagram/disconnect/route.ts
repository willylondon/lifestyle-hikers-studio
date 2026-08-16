import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth-server';
import { deleteInstagramConnection } from '@/lib/instagram-repo';

export async function POST() {
  try {
    const session = await requireSession();
    await deleteInstagramConnection(session.userId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
