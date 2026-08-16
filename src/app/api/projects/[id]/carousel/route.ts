import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth-server';
import { getProject, loadCarousel, saveCarousel, loadConcepts, saveConcept, updateProjectStatus } from '@/lib/repo';
import { z } from 'zod';
import { generateCaption } from '@/captions/engine';
import { buildStory, generateHooks, pickBestHook } from '@/carousels/story';
import { DEFAULT_WEIGHTS, generateConcepts, scoreConcept } from '@/concepts/engine';
import { listAssetAnalyses, listAssets, saveAssetAnalysis } from '@/lib/media-repo';
import { readMedia } from '@/lib/storage';
import { analyzePhotoAsync } from '@/analysis/photo';
import { deriveProfile } from '@/enhancement/engine';
import sharp from 'sharp';
import type { Carousel, MediaAsset, PhotoAnalysis, Project } from '@/lib/types';

const slideSchema = z.object({
  id: z.string(),
  order: z.number(),
  role: z.enum(['hook', 'setup', 'development', 'payoff', 'takeaway', 'cta']),
  headline: z.string(),
  body: z.string(),
  assetId: z.string().nullable(),
  textPosition: z.enum(['top', 'bottom', 'center', 'upper-left', 'lower-right']),
  showBranding: z.boolean(),
  pageLabel: z.string(),
});

async function ensurePhotoAnalyses(project: Project, assets: MediaAsset[]): Promise<PhotoAnalysis[]> {
  const saved = await listAssetAnalyses(project.id);
  const byAsset = new Map(saved.map((analysis) => [analysis.assetId, analysis]));

  await Promise.all(assets.filter((asset) => asset.kind === 'image' && !byAsset.has(asset.id)).map(async (asset) => {
    const buffer = await readMedia('enhanced', `${asset.sourceId}.jpg`);
    const profile = deriveProfile(await sharp(buffer).stats());
    const analysis = await analyzePhotoAsync(buffer, asset.filename, profile, {
      width: asset.width,
      height: asset.height,
      orientation: asset.orientation,
    });
    analysis.assetId = asset.id;
    await saveAssetAnalysis(analysis);
    byAsset.set(asset.id, analysis);
  }));

  return assets.flatMap((asset) => {
    const analysis = byAsset.get(asset.id);
    return analysis ? [analysis] : [];
  });
}

async function rebuildGroundedCarousel(project: Project, carousel: Carousel, userId: string) {
  const assets = await listAssets(project.id);
  const analyses = await ensurePhotoAnalyses(project, assets);
  const concepts = generateConcepts(project.id, analyses, {
    name: project.name,
    location: project.location,
    context: project.context,
  });
  const scores = concepts.map((concept) => scoreConcept(concept, analyses, DEFAULT_WEIGHTS));
  let selectedIndex = 0;
  scores.forEach((score, index) => {
    if (score.total > scores[selectedIndex].total) selectedIndex = index;
  });
  const selected = concepts[selectedIndex];
  const assetIds = assets.filter((asset) => asset.kind === 'image').map((asset) => asset.id);
  concepts.forEach((concept) => {
    concept.suggestedPhotoIds = assetIds.slice(0, 6);
  });
  await Promise.all(concepts.map((concept, index) => saveConcept(project.id, concept, scores[index].total)));

  const hook = pickBestHook(generateHooks(selected));
  carousel.conceptId = selected.id;
  carousel.title = selected.title;
  carousel.pillar = selected.pillar;
  carousel.slides = buildStory(selected, hook, analyses, assetIds);
  carousel.caption = generateCaption(selected, carousel.slides, project.location);
  carousel.status = 'Needs Review';
  await saveCarousel(carousel);
  await updateProjectStatus(project.id, userId, 'Needs Review');
  return carousel;
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    const { id } = await params;
    const project = await getProject(id, session.userId);
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    const carousel = await loadCarousel(id);
    if (!carousel) return NextResponse.json({ error: 'No carousel yet' }, { status: 404 });

    const body = await req.json();

    if (body.action === 'regenerate-grounded') {
      const rebuilt = await rebuildGroundedCarousel(project, carousel, session.userId);
      return NextResponse.json({ carousel: rebuilt });
    }

    if (body.action === 'edit-slides') {
      const parsed = z.array(slideSchema).safeParse(body.slides);
      if (!parsed.success) {
        return NextResponse.json({ error: 'Invalid slides', details: parsed.error.flatten() }, { status: 400 });
      }
      carousel.slides = parsed.data;
      await saveCarousel(carousel);
      return NextResponse.json({ carousel });
    }

    if (body.action === 'regenerate-caption') {
      const concepts = await loadConcepts(id);
      const concept = concepts.find((c) => c.id === carousel.conceptId) ?? concepts[0];
      if (concept) {
        carousel.caption = generateCaption(concept, carousel.slides, project.location);
        await saveCarousel(carousel);
      }
      return NextResponse.json({ carousel });
    }

    if (body.action === 'switch-concept') {
      const concepts = await loadConcepts(id);
      const concept = concepts.find((c) => c.id === body.conceptId);
      if (!concept) return NextResponse.json({ error: 'Concept not found' }, { status: 404 });
      const hook = pickBestHook(generateHooks(concept));
      const assets = await listAssets(id);
      const analyses = await ensurePhotoAnalyses(project, assets);
      const assetIds = assets.filter((asset) => asset.kind === 'image').map((asset) => asset.id);
      carousel.conceptId = concept.id;
      carousel.title = concept.title;
      carousel.pillar = concept.pillar;
      carousel.slides = buildStory(concept, hook, analyses, assetIds);
      carousel.caption = generateCaption(concept, carousel.slides, project.location);
      await saveCarousel(carousel);
      return NextResponse.json({ carousel });
    }

    if (body.action === 'approve') {
      carousel.status = 'Approved';
      await saveCarousel(carousel);
      return NextResponse.json({ carousel });
    }

    if (body.action === 'set-status') {
      carousel.status = body.status;
      await saveCarousel(carousel);
      return NextResponse.json({ carousel });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (e) {
    if ((e as Error).message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
