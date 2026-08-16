// Pipeline orchestrator: runs the full workflow end-to-end with resumable stages.
// Every major AI decision is surfaced to the user, never hidden.

import sharp from 'sharp';
import { generateSourceId, newId } from '../lib/ids';
import { writeMedia, readMedia } from '../lib/storage';
import type { MediaAsset, PhotoAnalysis, Project, Carousel, Concept, ConceptScore, StageState, ApprovalStatus } from '../lib/types';
import { PIPELINE_STAGES, type PipelineStage } from '../lib/types';
import { deriveProfile, applyEnhancement } from '../enhancement/engine';
import { analyzePhotoAsync } from '../analysis/photo';
import { compareImages } from '../qa/photo-qa';
import { generateConcepts, scoreConcept, DEFAULT_WEIGHTS } from '../concepts/engine';
import { generateHooks, pickBestHook, buildStory } from '../carousels/story';
import { generateCaption, generateAltText } from '../captions/engine';
import { detectSafetyContexts, classifyClaims } from '../qa/safety';
import { saveConcept, saveCarousel, newCarouselId } from '../lib/repo';
import { saveAsset, saveAssetAnalysis } from '../lib/media-repo';
import { normalizeImageForProcessing } from '../lib/image-normalization';

export interface UploadedFile {
  filename: string;
  mimeType: string;
  buffer: Buffer;
}

export interface PipelineResult {
  project: Project;
  assets: MediaAsset[];
  analyses: PhotoAnalysis[];
  concepts: Concept[];
  scores: ConceptScore[];
  selectedConcept: Concept;
  carousel: Carousel;
  stages: StageState[];
  safetyFlags: ReturnType<typeof detectSafetyContexts>;
  factChecks: ReturnType<typeof classifyClaims>;
}

export interface StageCallback {
  onStage: (stage: PipelineStage, status: StageState['status'], message?: string) => void;
}

function defaultCallback(): StageCallback {
  return { onStage: () => {} };
}

export async function runPipeline(
  project: Project,
  files: UploadedFile[],
  cb: StageCallback = defaultCallback(),
): Promise<PipelineResult> {
  const stages: StageState[] = PIPELINE_STAGES.map((key) => ({ key, label: labelFor(key), status: 'pending' }));
  const emit = (key: PipelineStage, status: StageState['status'], message?: string) => {
    const s = stages.find((x) => x.key === key);
    if (s) {
      s.status = status;
      s.message = message;
    }
    cb.onStage(key, status, message);
  };

  // 1. Preserve + ingest
  emit('upload', 'running', `Ingesting ${files.length} file(s)`);
  const assets: MediaAsset[] = [];
  const enhancedBuffers = new Map<string, Buffer>();
  const originalBuffers = new Map<string, Buffer>();
  const analyses: PhotoAnalysis[] = [];

  let seq = 1;
  for (const file of files) {
    const isImage = file.mimeType.startsWith('image/');
    const kind = isImage ? 'image' : 'video';
    const sourceId = generateSourceId(project.slug, seq);
    seq++;

    const processingFile = isImage
      ? await normalizeImageForProcessing(file.buffer, file.filename, file.mimeType)
      : { ...file, converted: false };
    const processingBuffer = processingFile.buffer;

    // Determine dimensions + orientation.
    let width = 0;
    let height = 0;
    let orientation: MediaAsset['orientation'] = 'landscape';
    if (isImage) {
      const meta = await sharp(processingBuffer, { failOn: 'none' }).metadata();
      width = meta.width ?? 0;
      height = meta.height ?? 0;
      orientation = width > height ? 'landscape' : height > width ? 'portrait' : 'square';
    }

    // Preserve original (immutable).
    await writeMedia('original', `${sourceId}${ext(file.filename)}`, file.buffer);
    if (processingFile.converted) {
      await writeMedia('derivative', `${sourceId}-source-preview.jpg`, processingBuffer);
    }
    originalBuffers.set(sourceId, processingBuffer);

    const asset: MediaAsset = {
      id: newId('ast'),
      projectId: project.id,
      sourceId,
      kind,
      mimeType: file.mimeType,
      filename: file.filename,
      width,
      height,
      orientation,
      bytes: file.buffer.length,
      createdAt: new Date().toISOString(),
    };
    await saveAsset(asset);
    assets.push(asset);

    // 2. Analyze
    emit('analyze', 'running', `Analyzing ${file.filename}`);
    if (isImage) {
      const profile = deriveProfile(await sharp(processingBuffer).stats());
      const analysis = await analyzePhotoAsync(processingBuffer, file.filename, profile, { width, height, orientation });
      analysis.assetId = asset.id;
      analyses.push(analysis);

      // 3. Enhance (mandatory, non-destructive)
      emit('enhance', 'running', `Enhancing ${file.filename}`);
      const enhanced = await applyEnhancement(processingBuffer, profile, asset);
      await writeMedia('enhanced', `${sourceId}.jpg`, enhanced);
      enhancedBuffers.set(sourceId, enhanced);

      // 4. QA
      emit('qa', 'running', `QA ${file.filename}`);
      const qa = await compareImages(processingBuffer, enhanced);
      analysis.qaConfidence = qa.confidence;
      if (!qa.passed) {
        // Revert: keep original as enhanced master.
        await writeMedia('enhanced', `${sourceId}.jpg`, processingBuffer);
        enhancedBuffers.set(sourceId, processingBuffer);
        analysis.qaConfidence = 1;
        analysis.enhancement = { ...profile, exposure: 0, contrast: 0, clarity: 0, sharpening: 0, vibrance: 0, highlights: 0, shadows: 0 };
      }
      await saveAssetAnalysis(analysis);
    } else {
      // Videos are preserved but not photo-enhanced.
      await writeMedia('enhanced', `${sourceId}${ext(file.filename)}`, file.buffer);
      enhancedBuffers.set(sourceId, file.buffer);
    }
  }
  emit('upload', 'done');
  emit('preserve', 'done', 'Originals preserved immutably');
  emit('analyze', 'done');
  emit('enhance', 'done');
  emit('qa', 'done');

  // 5. Content intelligence + idea generation
  emit('intelligence', 'running', 'Identifying content opportunities');
  const context = { name: project.name, location: project.location, context: project.context };
  const concepts = generateConcepts(project.id, analyses, context);
  emit('ideas', 'done', `${concepts.length} concepts generated`);
  emit('intelligence', 'done');

  // 6. Concept scoring
  emit('scoring', 'running', 'Scoring concepts for brand fit & engagement');
  const scores = concepts.map((c) => scoreConcept(c, analyses, DEFAULT_WEIGHTS));
  emit('scoring', 'done');

  // 7. Winning concept selection
  emit('selection', 'running', 'Selecting strongest concept');
  let bestIdx = 0;
  scores.forEach((s, i) => {
    if (s.total > scores[bestIdx].total) bestIdx = i;
  });
  const selected = concepts[bestIdx];
  // Persist concepts + scores
  await Promise.all(concepts.map((c, i) => saveConcept(project.id, c, scores[i].total)));
  emit('selection', 'done', `Selected: "${selected.title}"`);

  // 8. Photo selection
  emit('photo-select', 'running', 'Selecting photos');
  const assetIds = assets.filter((a) => a.kind === 'image').map((a) => a.id);
  // Assign suggested photo IDs to concepts
  concepts.forEach((c) => {
    c.suggestedPhotoIds = assetIds.slice(0, Math.max(3, Math.min(assetIds.length, 6)));
  });
  emit('photo-select', 'done');

  // 9. Carousel story architecture
  emit('story', 'running', 'Building carousel story');
  const hooks = generateHooks(selected);
  const hook = pickBestHook(hooks);
  const slides = buildStory(selected, hook, analyses, assetIds);
  emit('story', 'done', `${slides.length} slides`);

  // 10. Design (render slides)
  emit('design', 'running', 'Designing slides');
  const slideBuffers: Buffer[] = [];
  const { renderSlide } = await import('../design/slide-render');
  for (const slide of slides) {
    const asset = assets.find((a) => a.id === slide.assetId);
    if (asset) {
      const buf = enhancedBuffers.get(asset.sourceId) ?? originalBuffers.get(asset.sourceId);
      if (buf) slideBuffers.push(await renderSlide(buf, slide));
    }
  }
  emit('design', 'done', `${slideBuffers.length} slides rendered`);

  // 11. Caption + SEO + alt text
  emit('caption', 'running', 'Generating caption & hashtags');
  const caption = generateCaption(selected, slides, project.location);
  const altTexts = slides.map((s) => generateAltText(s, selected));
  void altTexts;
  emit('caption', 'done');

  // 12. Brand/fact/safety QA
  emit('qa-final', 'running', 'Final QA');
  const safetyFlags = detectSafetyContexts(analyses);
  const factChecks = classifyClaims([caption.hook, ...caption.story, caption.value].join(' '));
  emit('qa-final', 'done');

  // 13. Assemble carousel
  const carousel: Carousel = {
    id: newCarouselId(),
    projectId: project.id,
    conceptId: selected.id,
    title: selected.title,
    pillar: selected.pillar,
    slides,
    caption,
    status: 'Needs Review',
  };
  await saveCarousel(carousel);

  emit('review', 'done', 'Ready for human review');

  return {
    project,
    assets,
    analyses,
    concepts,
    scores,
    selectedConcept: selected,
    carousel,
    stages,
    safetyFlags,
    factChecks,
  };
}

function labelFor(key: PipelineStage): string {
  const map: Record<PipelineStage, string> = {
    upload: 'Upload',
    preserve: 'Source Preservation',
    analyze: 'Media Analysis',
    enhance: 'Photo Enhancement',
    qa: 'Image Quality Control',
    intelligence: 'Content Intelligence',
    ideas: 'Idea Generation',
    scoring: 'Concept Scoring',
    selection: 'Concept Selection',
    'photo-select': 'Photo Selection',
    story: 'Story Architecture',
    design: 'Slide Design',
    caption: 'Caption & Hashtags',
    'qa-final': 'Brand / Fact / Safety QA',
    review: 'Human Review',
  };
  return map[key];
}

function ext(filename: string): string {
  const i = filename.lastIndexOf('.');
  return i >= 0 ? filename.slice(i).toLowerCase() : '.jpg';
}

// Re-export for convenience.
export { newId };
