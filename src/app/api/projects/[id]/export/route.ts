import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth-server';
import { getProject, loadCarousel } from '@/lib/repo';
import { getAssetById } from '@/lib/media-repo';
import { renderSlide } from '@/design/slide-render';
import { readMedia, writeMedia } from '@/lib/storage';
import { buildZip } from '@/export/exporter';
import { createSignedObjectUrl, isSupabaseEnabled } from '@/lib/supabase';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    const { id } = await params;
    const project = await getProject(id, session.userId);
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    const carousel = await loadCarousel(id);
    if (!carousel) return NextResponse.json({ error: 'No carousel yet' }, { status: 404 });

    const slideBuffers: Buffer[] = [];
    for (const slide of carousel.slides) {
      if (!slide.assetId) continue;
      const asset = await getAssetById(slide.assetId);
      if (!asset) continue;

      // Locate enhanced master (or original fallback) by sourceId.
      let buf: Buffer | null = null;
      for (const state of ['enhanced', 'original'] as const) {
        for (const ext of ['.jpg', '.jpeg', '.png', '.webp', '.heic']) {
          try {
            buf = await readMedia(state, `${asset.sourceId}${ext}`);
            break;
          } catch {
            continue;
          }
        }
        if (buf) break;
      }
      if (buf) {
        slideBuffers.push(await renderSlide(buf, slide));
      }
    }

    if (slideBuffers.length === 0) {
      return NextResponse.json({ error: 'No renderable slides' }, { status: 400 });
    }

    const zipBuffer = await buildZip(carousel, project, slideBuffers);
    const filename = `lifestyle-hikers-${project.slug}-carousel.zip`;
    if (isSupabaseEnabled()) {
      const objectPath = await writeMedia('export', filename, zipBuffer);
      const downloadUrl = await createSignedObjectUrl(objectPath, 600, filename);
      return NextResponse.json({ downloadUrl, filename });
    }
    return new NextResponse(new Uint8Array(zipBuffer), {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (e) {
    if ((e as Error).message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
