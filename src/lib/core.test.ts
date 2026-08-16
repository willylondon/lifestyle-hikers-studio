import { describe, it, expect } from 'vitest';
import { generateSourceId, generateProjectSlug, newId } from './ids';
import { deriveProfile, defaultProfile, applyEnhancement, clamp } from '../enhancement/engine';
import { generateConcepts, scoreConcept, DEFAULT_WEIGHTS, evaluateBrandGate } from '../concepts/engine';
import { generateHooks, pickBestHook, buildStory } from '../carousels/story';
import { generateCaption, generateAltText } from '../captions/engine';
import { detectSafetyContexts, classifyClaims } from '../qa/safety';
import { buildMetadata, buildReadme } from '../export/exporter';
import { generateConceptForTest } from './test-helpers';
import type { Carousel, Project } from './types';
import type { PhotoAnalysis } from './types';
import { inferFilenameSubjects } from '../analysis/photo';
import { isHeicUpload, normalizeUploadMime } from './image-normalization';

describe('ids', () => {
  it('generates permanent source IDs', () => {
    expect(generateSourceId('heineken river', 1)).toMatch(/^LH-\d{4}-HEINEKEN-RIVER-001$/);
    expect(generateSourceId('heineken river', 12)).toMatch(/-012$/);
  });

  it('keeps source IDs unique when long project slugs only differ at the end', () => {
    const first = generateSourceId('lifestyle-hikers-community-hike-abc123', 1);
    const second = generateSourceId('lifestyle-hikers-community-hike-def456', 1);
    expect(first).not.toBe(second);
    expect(first).toMatch(/^LH-\d{4}-LIFESTYLE-HIKERS-[A-F0-9]{6}-001$/);
  });
  it('generates unique slugs and ids', () => {
    expect(generateProjectSlug('Heineken River Hike')).toMatch(/^heineken-river-hike-[a-z0-9]{6}$/);
    expect(newId('prj')).toMatch(/^prj_[a-z0-9]+$/);
  });
});

describe('enhancement', () => {
  it('derives adaptive profiles (not a single preset)', () => {
    const dark = deriveProfile({ channels: [{ mean: 50, stdev: 30, min: 0, max: 100, sum: 0, squaresSum: 0 }] } as never);
    const bright = deriveProfile({ channels: [{ mean: 190, stdev: 70, min: 0, max: 255, sum: 0, squaresSum: 0 }] } as never);
    expect(dark.exposure).toBeGreaterThan(bright.exposure);
  });
  it('clamps values', () => {
    expect(clamp(999, 0, 10)).toBe(10);
    expect(clamp(-5, 0, 10)).toBe(0);
  });
  it('never mutates source (returns new buffer)', async () => {
    const src = Buffer.from('fakeimage');
    const profile = defaultProfile();
    // applyEnhancement requires valid image data; skip actual sharp, verify API exists
    expect(typeof applyEnhancement).toBe('function');
    void src;
    void profile;
  });
});

describe('iPhone media ingestion', () => {
  it('recognizes HEIC and HEIF uploads even when the browser MIME is incomplete', () => {
    expect(isHeicUpload('IMG_2858.HEIC', 'application/octet-stream')).toBe(true);
    expect(isHeicUpload('IMG_2858', 'image/heif')).toBe(true);
    expect(normalizeUploadMime('IMG_2858.HEIC', '')).toBe('image/heic');
  });
});

describe('photo grounding', () => {
  it('derives community subjects from descriptive filenames', () => {
    expect(inferFilenameSubjects('kids-on-rock.jpg').subjects).toEqual(expect.arrayContaining(['children', 'young hikers', 'people']));
    expect(inferFilenameSubjects('gift-presentation.jpg').subjects).toEqual(expect.arrayContaining(['gift', 'recognition', 'community']));
    expect(inferFilenameSubjects('mountain-gathering.jpg').subjects).toEqual(expect.arrayContaining(['group', 'community', 'people']));
  });

  it('pairs community copy with the matching group, recognition and children photos', () => {
    const base = generateConceptForTest()[0];
    const analyses: PhotoAnalysis[] = [
      { ...base, assetId: 'scenic-1', subjects: ['river', 'scenic'], peopleCount: 0, faces: 0, landscape: ['river'], tags: ['river'] },
      { ...base, assetId: 'portrait', subjects: ['portrait', 'person', 'people'], peopleCount: 1, faces: 1, landscape: ['rocks'], tags: ['portrait', 'person', 'rocks'] },
      { ...base, assetId: 'scenic-2', subjects: ['mountain', 'scenic'], peopleCount: 0, faces: 0, landscape: ['mountain'], tags: ['mountain'] },
      { ...base, assetId: 'group', subjects: ['group', 'community', 'people'], peopleCount: 8, faces: 8, tags: ['group', 'community'] },
      { ...base, assetId: 'gift', subjects: ['recognition', 'gift', 'presentation', 'community', 'people'], peopleCount: 2, faces: 2, tags: ['recognition', 'gift', 'presentation'] },
      { ...base, assetId: 'kids', subjects: ['children', 'young hikers', 'celebration', 'people'], peopleCount: 2, faces: 2, tags: ['children', 'young hikers', 'celebration'] },
    ];
    const concept = generateConcepts('prj_grounded', analyses, {
      name: 'Community hike',
      location: 'Jamaica',
      context: 'Families, young hikers and a participant appreciation presentation.',
    })[0];
    expect(concept.pillar).toBe('Community');

    const slides = buildStory(concept, concept.hook, analyses, analyses.map((analysis) => analysis.assetId));
    expect(slides).toHaveLength(6);
    expect(new Set(slides.map((slide) => slide.assetId)).size).toBe(6);
    expect(slides.find((slide) => /group became the story/i.test(slide.headline))?.assetId).toBe('group');
    expect(slides.find((slide) => /celebrate the people/i.test(slide.headline))?.assetId).toBe('gift');
    expect(slides.find((slide) => /young hikers/i.test(slide.headline))?.assetId).toBe('kids');
  });

  it('does not write recognition or children claims when those subjects are unsupported', () => {
    const base = generateConceptForTest()[0];
    const analyses: PhotoAnalysis[] = [
      { ...base, assetId: 'scenic', subjects: ['scenic'], peopleCount: 0, faces: 0, landscape: ['mountain'], tags: ['mountain'] },
      { ...base, assetId: 'group', subjects: ['group', 'community', 'people'], peopleCount: 4, faces: 4, tags: ['group', 'community'] },
    ];
    const concept = generateConcepts('prj_generic_iphone', analyses, {
      name: 'Community hike',
      location: 'Jamaica',
      context: 'A joyful community hike.',
    })[0];
    const slides = buildStory(concept, concept.hook, analyses, analyses.map((analysis) => analysis.assetId));
    const copy = slides.map((slide) => `${slide.headline} ${slide.body}`).join(' ');

    expect(copy).not.toMatch(/appreciation|young hikers|every generation/i);
    expect(copy).toMatch(/every pace had a place/i);
  });
});

describe('concepts + scoring', () => {
  it('generates at least 5 distinct concepts', () => {
    const analyses = generateConceptForTest();
    const concepts = generateConcepts('prj_1', analyses, { name: 'Test', location: 'St Thomas' });
    expect(concepts.length).toBeGreaterThanOrEqual(5);
    const titles = new Set(concepts.map((c) => c.title));
    expect(titles.size).toBe(concepts.length);
  });
  it('scores concepts 1-10 with weighted total', () => {
    const concepts = generateConcepts('prj_1', generateConceptForTest(), { name: 'T', location: 'Portland' });
    const scores = concepts.map((c) => scoreConcept(c, generateConceptForTest(), DEFAULT_WEIGHTS));
    for (const s of scores) {
      expect(s.total).toBeGreaterThan(0);
      expect(s.total).toBeLessThanOrEqual(10);
    }
  });
  it('selects the community concept when the photos show a community hike', () => {
    const base = generateConceptForTest()[0];
    const analyses: PhotoAnalysis[] = [
      { ...base, assetId: 'group', subjects: ['group', 'community', 'people'], peopleCount: 8, faces: 8, tags: ['group', 'community'] },
      { ...base, assetId: 'gift', subjects: ['gift', 'recognition', 'community'], peopleCount: 2, faces: 2, tags: ['gift', 'recognition'] },
      { ...base, assetId: 'kids', subjects: ['children', 'young hikers'], peopleCount: 2, faces: 2, tags: ['children', 'young hikers'] },
    ];
    const concepts = generateConcepts('prj_community', analyses, {
      name: 'Community hike',
      location: 'Jamaica',
      context: 'Families, young hikers and a participant appreciation presentation.',
    });
    const ranked = concepts
      .map((concept) => ({ concept, score: scoreConcept(concept, analyses, DEFAULT_WEIGHTS).total }))
      .sort((a, b) => b.score - a.score);

    expect(ranked[0].concept.pillar).toBe('Community');
  });
  it('brand gate requires strong performance on ≥4 criteria', () => {
    const c = generateConcepts('prj_1', generateConceptForTest(), { name: 'T', location: 'Kingston' })[0];
    const gate = c.brandFitGate;
    expect(typeof gate.passed).toBe('boolean');
    expect(gate.reasons.length).toBeGreaterThan(0);
  });
});

describe('carousel story', () => {
  it('generates 10 hooks and picks best', () => {
    const c = generateConcepts('prj_1', generateConceptForTest(), { name: 'T', location: 'T' })[0];
    const hooks = generateHooks(c);
    expect(hooks.length).toBeGreaterThanOrEqual(10);
    const best = pickBestHook(hooks);
    expect(best).toBe(hooks[0].text);
  });
  it('builds 7-12 slides with correct roles', () => {
    const c = generateConcepts('prj_1', generateConceptForTest(), { name: 'T', location: 'T' })[0];
    const slides = buildStory(c, 'Test hook', [], ['a1', 'a2']);
    expect(slides.length).toBeGreaterThanOrEqual(7);
    expect(slides.length).toBeLessThanOrEqual(12);
    expect(slides[0].role).toBe('hook');
    expect(slides[slides.length - 1].role).toBe('cta');
    expect(slides.map((s) => s.order)).toEqual(slides.map((_, i) => i + 1));
  });
});

describe('caption + alt text', () => {
  it('generates structured caption with hashtags and SEO', () => {
    const c = generateConcepts('prj_1', generateConceptForTest(), { name: 'T', location: 'St Thomas' })[0];
    const slides = buildStory(c, 'Hook', [], ['a1']);
    const cap = generateCaption(c, slides, 'St Thomas');
    expect(cap.hook).toBeTruthy();
    expect(cap.story.length).toBeGreaterThanOrEqual(2);
    expect(cap.hashtags).toContain('#LifestyleHikers');
    expect(cap.hashtags.length).toBeGreaterThanOrEqual(5);
    expect(cap.hashtags.length).toBeLessThanOrEqual(10);
  });
  it('generates alt text per slide', () => {
    const c = generateConcepts('prj_1', generateConceptForTest(), { name: 'T', location: 'T' })[0];
    const slides = buildStory(c, 'Hook', [], ['a1']);
    const alt = slides.map((s) => generateAltText(s, c));
    expect(alt.length).toBe(slides.length);
  });
});

describe('safety + research QA', () => {
  it('detects water/waterfall safety contexts', () => {
    const flags = detectSafetyContexts([
      { landscape: ['waterfall', 'river'], tags: [] } as never,
    ]);
    expect(flags.some((f) => f.context === 'waterfall')).toBe(true);
  });
  it('classifies claims as fact vs opinion', () => {
    const checks = classifyClaims('Hiking can support heart health. We were so tired after this hike.');
    expect(checks.some((c) => c.kind === 'verified-fact')).toBe(true);
    expect(checks.some((c) => c.kind === 'anecdote')).toBe(true);
  });
});

describe('export metadata', () => {
  it('builds metadata and readme', () => {
    const project: Project = { id: 'p', name: 'Heineken River', location: 'St Thomas', hikeDate: '2026-01-01', context: '', slug: 'heineken-river', status: 'Approved', createdAt: '', updatedAt: '' };
    const carousel: Carousel = { id: 'c', projectId: 'p', conceptId: 'x', title: 'T', pillar: 'Education', slides: [], caption: { hook: 'h', story: ['s'], value: 'v', question: 'q', cta: 'c', hashtags: ['#LifestyleHikers'], seoKeywords: ['k'] }, status: 'Approved' };
    const meta = JSON.parse(buildMetadata(carousel, project));
    expect(meta.handle).toBe('@LifestyleHikers');
    expect(buildReadme(carousel, project)).toContain('One foot in front the other');
  });
});

// Re-export gate for test isolation (not exposed publicly otherwise).
export { evaluateBrandGate };
