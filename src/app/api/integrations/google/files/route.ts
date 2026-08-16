import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth-server';
import { listDriveFolder } from '@/lib/google-drive';

export async function GET(req: Request) {
  try {
    const session = await requireSession();
    const folderId = new URL(req.url).searchParams.get('folderId') || 'root';
    const files = await listDriveFolder(session.userId, folderId);
    return NextResponse.json({ files });
  } catch (e) {
    const message = (e as Error).message;
    const status = message.includes('NOT_CONNECTED') || message.includes('RECONNECT') ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
