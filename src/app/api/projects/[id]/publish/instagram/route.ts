import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth-server';
import { getProject, loadCarousel, saveCarousel } from '@/lib/repo';
import { getAssetById } from '@/lib/media-repo';
import { getInstagramConnection } from '@/lib/instagram-repo';
import { assertMetaCanFetchImage, createCarouselContainer, createImageContainer, isExpectedInstagramConnection, publishContainer, waitForContainerReady } from '@/lib/instagram';
import { createPublishJob, updatePublishJob } from '@/lib/publish-repo';
import { createSignedObjectUrl, isSupabaseEnabled } from '@/lib/supabase';
import { readMedia, writeMedia } from '@/lib/storage';
import { renderSlide } from '@/design/slide-render';

function formatCaption(carousel: NonNullable<Awaited<ReturnType<typeof loadCarousel>>>): string {
  const c = carousel.caption;
  return [c.hook, '', ...c.story, '', c.value, '', c.question, '', c.cta, '', c.hashtags.join(' ')].join('\n');
}

async function loadEnhancedAsset(assetId: string): Promise<Buffer> {
  const asset = await getAssetById(assetId);
  if (!asset) throw new Error(`Media asset ${assetId} was not found.`);
  for (const state of ['enhanced', 'original'] as const) {
    for (const ext of ['.jpg', '.jpeg', '.png', '.webp', '.heic']) {
      try { return await readMedia(state, `${asset.sourceId}${ext}`); } catch { /* try next */ }
    }
  }
  throw new Error(`No image file was found for ${asset.sourceId}.`);
}

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  let jobId = '';
  let publishedMediaId = '';
  let carouselToPublish: NonNullable<Awaited<ReturnType<typeof loadCarousel>>> | null = null;
  try {
    const session = await requireSession();
    const { id } = await params;
    const project = await getProject(id, session.userId);
    if (!project) return NextResponse.json({ error: 'Project not found.' }, { status: 404 });
    const carousel = await loadCarousel(id);
    if (!carousel) return NextResponse.json({ error: 'No carousel has been generated yet.' }, { status: 404 });
    carouselToPublish = carousel;
    if (carousel.status !== 'Approved') {
      return NextResponse.json({ error: 'Approve the carousel before publishing it to Instagram.' }, { status: 409 });
    }
    if (!isSupabaseEnabled()) {
      return NextResponse.json({ error: 'Instagram publishing requires Supabase Storage so Meta can securely fetch the rendered slides.' }, { status: 503 });
    }

    const connection = await getInstagramConnection(session.userId);
    if (!connection?.accessToken || !connection.instagramAccountId) {
      return NextResponse.json({ error: 'Connect an Instagram professional account in Settings first.' }, { status: 409 });
    }
    if (!isExpectedInstagramConnection(connection)) {
      return NextResponse.json({ error: 'Reconnect the configured @LifestyleHikers Professional account in Settings.' }, { status: 409 });
    }
    if (connection.expiresAt && new Date(connection.expiresAt).getTime() <= Date.now()) {
      return NextResponse.json({ error: 'The Instagram connection has expired. Reconnect it in Settings.' }, { status: 409 });
    }
    if (carousel.slides.length < 1) return NextResponse.json({ error: 'The carousel has no slides.' }, { status: 400 });
    if (carousel.slides.length > 10) {
      return NextResponse.json({ error: 'This carousel has more than 10 slides. Reduce it to 10 or fewer before API publishing.' }, { status: 400 });
    }

    const job = await createPublishJob(carousel.id, carousel.slides.length === 1 ? 'instagram-image' : 'instagram-carousel');
    jobId = job.id;
    carousel.status = 'Publishing';
    await saveCarousel(carousel);
    const childContainers: string[] = [];

    for (const slide of carousel.slides) {
      if (!slide.assetId) throw new Error(`Slide ${slide.order} has no source image.`);
      const source = await loadEnhancedAsset(slide.assetId);
      const rendered = await renderSlide(source, slide);
      const filename = `${project.slug}-${String(slide.order).padStart(2, '0')}.jpg`;
      const objectPath = await writeMedia('derivative', filename, rendered);
      const signedUrl = await createSignedObjectUrl(objectPath, 7200);
      await assertMetaCanFetchImage(signedUrl);
      const child = await createImageContainer({
        igUserId: connection.instagramAccountId,
        imageUrl: signedUrl,
        accessToken: connection.accessToken,
        carouselItem: carousel.slides.length > 1,
        caption: carousel.slides.length === 1 ? formatCaption(carousel) : undefined,
      });
      childContainers.push(child);
    }

    await Promise.all(childContainers.map((containerId) => (
      waitForContainerReady(containerId, connection.accessToken)
    )));

    let parentContainer = childContainers[0];
    if (childContainers.length > 1) {
      parentContainer = await createCarouselContainer({
        igUserId: connection.instagramAccountId,
        children: childContainers,
        caption: formatCaption(carousel),
        accessToken: connection.accessToken,
      });
      await waitForContainerReady(parentContainer, connection.accessToken);
    }
    await updatePublishJob(job.id, { metaContainerId: parentContainer });

    const mediaId = await publishContainer({
      igUserId: connection.instagramAccountId,
      creationId: parentContainer,
      accessToken: connection.accessToken,
    });
    publishedMediaId = mediaId;
    carousel.status = 'Published';
    await saveCarousel(carousel);
    await updatePublishJob(job.id, { status: 'Published', metaMediaId: mediaId, error: null });
    return NextResponse.json({ ok: true, mediaId, username: connection.username, jobId: job.id });
  } catch (e) {
    const message = (e as Error).message;
    const finalStatus = publishedMediaId ? 'Published' : 'Failed';
    if (carouselToPublish && jobId) {
      carouselToPublish.status = finalStatus;
      await saveCarousel(carouselToPublish).catch(() => undefined);
    }
    if (jobId) {
      await updatePublishJob(jobId, {
        status: finalStatus,
        metaMediaId: publishedMediaId || undefined,
        error: publishedMediaId ? 'Instagram published the media, but local finalization failed.' : message,
      }).catch(() => undefined);
    }
    const status = message === 'UNAUTHORIZED' ? 401 : 500;
    const error = publishedMediaId
      ? 'Instagram published this carousel, but saving the final publish record failed. Do not publish it again.'
      : message;
    return NextResponse.json({ error, status: finalStatus, mediaId: publishedMediaId || undefined }, { status });
  }
}
