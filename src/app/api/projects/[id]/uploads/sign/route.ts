import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireSession } from '@/lib/auth-server';
import { config } from '@/lib/config';
import { normalizeUploadMime } from '@/lib/image-normalization';
import { getProject } from '@/lib/repo';
import { createSignedUploadUrl, isSupabaseEnabled } from '@/lib/supabase';
import { safeFilename } from '@/lib/storage';

export const runtime = 'nodejs';

const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'video/mp4', 'video/quicktime']);
const requestSchema = z.object({
  files: z.array(z.object({
    filename: z.string().min(1).max(180),
    mimeType: z.string().max(100).default(''),
    size: z.number().int().positive().max(config.limits.maxUploadBytes),
  })).min(1).max(config.limits.maxFileCount),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    const { id } = await params;
    const project = await getProject(id, session.userId);
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    if (!isSupabaseEnabled()) {
      return NextResponse.json({ error: 'Cloud media storage is not configured.' }, { status: 503 });
    }

    const parsed = requestSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: 'Invalid file selection.' }, { status: 400 });

    const uploads = await Promise.all(parsed.data.files.map(async (file) => {
      const mimeType = normalizeUploadMime(file.filename, file.mimeType);
      if (!ALLOWED.has(mimeType)) throw new Error(`Unsupported file type: ${mimeType}`);
      const path = `incoming/${session.userId}/${id}/${randomUUID()}-${safeFilename(file.filename)}`;
      return {
        filename: file.filename,
        mimeType,
        size: file.size,
        path,
        signedUrl: await createSignedUploadUrl(path),
      };
    }));

    return NextResponse.json({ uploads });
  } catch (error) {
    if ((error as Error).message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
