import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth-server';
import { readMedia, mediaExists, safeFilename } from '@/lib/storage';
import { createSignedObjectUrl, isSupabaseEnabled } from '@/lib/supabase';
import path from 'node:path';

const MIME: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.heic': 'image/heic',
  '.mp4': 'video/mp4',
  '.mov': 'video/quicktime',
};

export async function GET(_req: Request, { params }: { params: Promise<{ state: string; filename: string }> }) {
  try {
    await requireSession();
    const { state, filename } = await params;
    if (!['original', 'enhanced', 'derivative', 'export'].includes(state)) {
      return NextResponse.json({ error: 'Invalid state' }, { status: 400 });
    }
    const st = state as 'original' | 'enhanced' | 'derivative' | 'export';
    if (isSupabaseEnabled()) {
      const signedUrl = await createSignedObjectUrl(`${st}/${safeFilename(filename)}`, 3600);
      return NextResponse.redirect(signedUrl);
    }
    if (!(await mediaExists(st, filename))) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    const buffer = await readMedia(st, filename);
    const ext = path.extname(filename).toLowerCase();
    const mime = MIME[ext] ?? 'application/octet-stream';
    return new NextResponse(new Uint8Array(buffer), {
      headers: { 'Content-Type': mime, 'Cache-Control': 'private, max-age=3600' },
    });
  } catch (e) {
    if ((e as Error).message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
