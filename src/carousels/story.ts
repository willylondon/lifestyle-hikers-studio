// Carousel story engine: concept-aware hooks, slide architecture, retention, and copy generation.

import type { Concept, PhotoAnalysis, Slide } from '../lib/types';
import { newId } from '../lib/ids';

const HOOK_PATTERNS = [
  'This is Jamaica too.',
  'Every hiker reaches this stage.',
  'Nobody warns beginners about this.',
  "We weren't ready for this part.",
  'The trail had other plans.',
  'Hiking does this to your body.',
  'Every group has one.',
  'Before you hike this trail...',
  'Most people drive past this.',
  'Which type of hiker are you?',
];

export interface HookCandidate {
  text: string;
  score: number;
  rationale: string;
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function tokenize(s: string): string[] {
  return normalize(s).split(' ').filter(Boolean);
}

function conceptKeywords(concept: Concept): string[] {
  return Array.from(new Set([...tokenize(concept.title), ...tokenize(concept.hook)])).filter((w) => w.length > 2);
}

function isCompatible(text: string, concept: Concept): boolean {
  const t = normalize(text);
  const title = normalize(concept.title);
  if (/which type of hiker|every group has one/.test(t)) return /type|group|person|trust|hiker/.test(title);
  if (/hiking does this to your body/.test(t)) return /body|health/.test(title);
  if (/before you hike this trail/.test(t)) return /before|trail|guide|pack|prepare/.test(title);
  if (/this is jamaica too/.test(t)) return /jamaica/.test(title);
  if (/most people drive past this/.test(t)) return /jamaica|stories|discovery|trail/.test(title);
  if (/every hiker reaches this stage/.test(t)) return /stages|stage|hiker|river/.test(title);
  if (/nobody warns beginners about this/.test(t)) return /nobody|before|river|guide|beginner/.test(title);
  return true;
}

function generatedHookVariants(concept: Concept): string[] {
  const title = concept.title;
  const t = normalize(title);
  if (/what nobody tells you about hiking jamaican rivers/.test(t)) {
    return [
      'Nobody warns you about this part of river hiking.',
      'Before you hike a Jamaican river, know this.',
      'Jamaican river hikes are different. Here\'s why.',
    ];
  }
  if (/trail brought us together/.test(t)) {
    return [
      'The views were only part of the story.',
      'We came for the trail and found community.',
      'The best part of this hike was the people.',
    ];
  }
  if (/6 stages of every river hike/.test(t)) {
    return [
      'The 6 stages of every river hike.',
      'Every river hike has these stages.',
      'Which river-hike stage gets you every time?',
    ];
  }
  if (/what hiking regularly does to your body/.test(t)) {
    return [
      'What hiking regularly does to your body.',
      'Your body notices every hike.',
      'Hiking changes more than your mood.',
    ];
  }
  if (/this is jamaica too/.test(t)) {
    return [
      'This is Jamaica too.',
      'There\'s a Jamaica you don\'t see from the highway.',
      'Jamaica looks different on foot.',
    ];
  }
  if (/before you hike this trail/.test(t)) {
    return [
      'Before you hike this trail...',
      'Read this before you show up to this hike.',
      'A better hike starts before the trailhead.',
    ];
  }
  if (/type of hiker/.test(t)) {
    return [
      'Which type of hiker are you?',
      'Every hike has these personalities.',
      'You\'ve definitely hiked with one of these.',
    ];
  }
  if (/almost there|cannot be trusted/.test(t)) {
    return [
      'The person who says “we\'re almost there” cannot be trusted.',
      'Every group has one.',
      'You already know who this is.',
    ];
  }
  return [concept.hook, title];
}

export function generateHooks(concept: Concept): HookCandidate[] {
  const titleWords = conceptKeywords(concept);
  const pool = [concept.hook, ...generatedHookVariants(concept), ...HOOK_PATTERNS.filter((h) => isCompatible(h, concept))];
  const seen = new Set<string>();
  const candidates: HookCandidate[] = [];

  for (const raw of pool) {
    const text = raw.trim();
    if (!text || seen.has(text)) continue;
    seen.add(text);

    const words = tokenize(text);
    const shared = words.filter((w) => titleWords.includes(w)).length;
    const relevance = Math.min(10, 5 + shared * 2 + (normalize(text) === normalize(concept.hook) ? 2 : 0));
    const curiosity = /nobody|before|which|this is|there's|stages|what/.test(normalize(text)) ? 9 : 7;
    const clarity = text.length <= 55 ? 9 : text.length <= 72 ? 7 : 5;
    const emotional = /body|trust|jamaica|river|group|community|people|together|warning|warns/.test(normalize(text)) ? 8 : 6;
    const specificity = /jamaica|river|trail|hiker|body|group|community|people|story/.test(normalize(text)) ? 8 : 6;
    const authenticity = /motivat|dream|inspire|quote/.test(normalize(text)) ? 4 : 9;
    const swipe = Math.round((curiosity + relevance) / 2);
    const score = Math.round(((relevance * 0.32) + (curiosity * 0.18) + (clarity * 0.16) + (specificity * 0.14) + (authenticity * 0.1) + (swipe * 0.1)) * 10) / 10;

    candidates.push({
      text,
      score,
      rationale: `relevance=${relevance}, curiosity=${curiosity}, clarity=${clarity}`,
    });
  }

  return candidates.sort((a, b) => b.score - a.score).slice(0, 10);
}

export function pickBestHook(candidates: HookCandidate[]): string {
  return candidates[0]?.text ?? 'This is Jamaica too.';
}

interface SlideBlueprint {
  role: Slide['role'];
  headline: string;
  body: string;
  photoTags?: string[];
}

function analysisTags(analysis: PhotoAnalysis): Set<string> {
  const tags = new Set([...analysis.subjects, ...analysis.landscape, ...analysis.terrain, ...analysis.water, ...analysis.tags].map(normalize));
  if (analysis.peopleCount > 0 || analysis.faces > 0) tags.add('people');
  if (analysis.peopleCount >= 2) tags.add('community');
  if (analysis.peopleCount === 0 && analysis.landscape.length > 0) tags.add('scenic');
  return tags;
}

function choosePhoto(
  slide: SlideBlueprint,
  analyses: PhotoAnalysis[],
  assetIds: string[],
  useCounts: Map<string, number>,
): string | null {
  const available = analyses.filter((analysis) => assetIds.includes(analysis.assetId));
  if (available.length === 0) {
    const fallback = assetIds.reduce<string | null>((best, assetId) => {
      if (!best) return assetId;
      return (useCounts.get(assetId) ?? 0) < (useCounts.get(best) ?? 0) ? assetId : best;
    }, null);
    if (fallback) useCounts.set(fallback, (useCounts.get(fallback) ?? 0) + 1);
    return fallback;
  }

  const wanted = (slide.photoTags ?? []).map(normalize);
  let best = available[0];
  let bestScore = Number.NEGATIVE_INFINITY;
  for (const analysis of available) {
    const tags = analysisTags(analysis);
    let score = 0;
    for (const tag of wanted) {
      if (tags.has(tag)) score += 12;
      else if ([...tags].some((candidate) => candidate.includes(tag) || tag.includes(candidate))) score += 4;
    }
    // A strong semantic match is more important than avoiding every repeat.
    // This reserves distinctive group, recognition, and children photos for the
    // slide that actually talks about them.
    score -= (useCounts.get(analysis.assetId) ?? 0) * 6;
    if (score > bestScore) {
      best = analysis;
      bestScore = score;
    }
  }
  useCounts.set(best.assetId, (useCounts.get(best.assetId) ?? 0) + 1);
  return best.assetId;
}

function photoMatchScore(slide: SlideBlueprint, analysis: PhotoAnalysis): number {
  const tags = analysisTags(analysis);
  return (slide.photoTags ?? []).reduce((score, rawTag) => {
    const tag = normalize(rawTag);
    if (tags.has(tag)) return score + 12;
    if ([...tags].some((candidate) => candidate.includes(tag) || tag.includes(candidate))) return score + 4;
    return score;
  }, 0);
}

function assignUniquePhotos(
  slides: SlideBlueprint[],
  analyses: PhotoAnalysis[],
  assetIds: string[],
): Array<string | null> {
  const available = analyses.filter((analysis) => assetIds.includes(analysis.assetId));
  if (assetIds.length < slides.length || available.length < slides.length) {
    const useCounts = new Map<string, number>();
    return slides.map((slide) => choosePhoto(slide, analyses, assetIds, useCounts));
  }

  const assignments: Array<string | null> = Array.from({ length: slides.length }, () => null);
  const unused = new Set(assetIds);
  const priority = slides
    .map((slide, index) => ({
      index,
      specificity: slide.photoTags?.length ?? 0,
      bestScore: Math.max(...available.map((analysis) => photoMatchScore(slide, analysis)), 0),
    }))
    .sort((a, b) => b.bestScore - a.bestScore || b.specificity - a.specificity || a.index - b.index);

  for (const { index } of priority) {
    const candidates = available
      .filter((analysis) => unused.has(analysis.assetId))
      .sort((a, b) => photoMatchScore(slides[index], b) - photoMatchScore(slides[index], a));
    const selected = candidates[0]?.assetId ?? [...unused][0] ?? null;
    assignments[index] = selected;
    if (selected) unused.delete(selected);
  }
  return assignments;
}

function fitStoryToAvailablePhotos(
  concept: Concept,
  slides: SlideBlueprint[],
  assetCount: number,
): SlideBlueprint[] {
  if (assetCount >= slides.length || assetCount <= 0) return slides;

  // Exact 1-to-1 match: if user uploaded N photos (e.g. 5), generate exactly N slides
  const hookSlide = slides.find((s) => s.role === 'hook') ?? slides[0];
  const ctaSlide = slides.find((s) => s.role === 'cta') ?? slides[slides.length - 1];

  if (assetCount === 1) return [hookSlide];
  if (assetCount === 2) return [hookSlide, ctaSlide];

  // Middle body slides
  const middleCandidates = slides.filter((s) => s.role !== 'hook' && s.role !== 'cta');
  const neededMiddle = assetCount - 2;
  const step = middleCandidates.length / neededMiddle;
  const selectedMiddle: SlideBlueprint[] = [];
  for (let i = 0; i < neededMiddle; i++) {
    const idx = Math.min(Math.floor(i * step), middleCandidates.length - 1);
    selectedMiddle.push(middleCandidates[idx]);
  }

  return [hookSlide, ...selectedMiddle, ctaSlide];
}

/**
 * Builds a 7–12 slide story architecture from a concept and analyses.
 * The selected concept controls the narrative. Generic unrelated hook families
 * are not allowed to override the idea.
 */
export function buildStory(
  concept: Concept,
  hook: string,
  analyses: PhotoAnalysis[],
  assetIds: string[],
): Slide[] {
  const pillar = concept.pillar;
  const slides: SlideBlueprint[] = [];
  const transitions = ['But then...', 'This is where things changed.', 'Look closer.', "Here\'s the part nobody mentions.", "That wasn't the hard part.", 'Then we reached this.'];

  slides.push({ role: 'hook', headline: hook, body: '', photoTags: ['scenic', 'river', 'mountain', 'trail'] });
  slides.push(createSetup(concept));

  const devCount = pillar === 'Education' || pillar === 'Practical Guides' || pillar === 'Community' ? 4 : 3;
  const devBodies = buildDevBodies(concept, devCount, analyses);
  devBodies.forEach((b, i) => {
    slides.push({
      role: 'development',
      headline: b.headline,
      body: pillar === 'Community' ? b.body : i < transitions.length && b.body ? `${transitions[i]} ${b.body}` : b.body,
      photoTags: b.photoTags,
    });
  });

  slides.push(createPayoff(concept));
  slides.push(createTakeaway(concept));
  slides.push(createCta(concept));

  const fittedSlides = fitStoryToAvailablePhotos(concept, slides, assetIds.length);
  const assignedAssetIds = assignUniquePhotos(fittedSlides, analyses, assetIds);
  return fittedSlides.map((s, i) => {
    const assetId = assignedAssetIds[i];
    return {
      id: newId('sld'),
      order: i + 1,
      role: s.role,
      headline: s.headline,
      body: s.body,
      assetId,
      textPosition: defaultTextPosition(s.role),
      showBranding: s.role === 'hook' || s.role === 'cta' || s.role === 'payoff',
      pageLabel: `${String(i + 1).padStart(2, '0')} / ${String(fittedSlides.length).padStart(2, '0')}`,
    };
  });
}

function defaultTextPosition(role: Slide['role']): Slide['textPosition'] {
  switch (role) {
    case 'hook':
    case 'payoff':
      return 'upper-left';
    case 'setup':
    case 'takeaway':
      return 'bottom';
    case 'cta':
      return 'center';
    default:
      return 'bottom';
  }
}

function createSetup(concept: Concept): SlideBlueprint {
  const t = normalize(concept.title);
  if (/trail brought us together/.test(t)) {
    return {
      role: 'setup',
      headline: 'We came for the trail.',
      body: 'The views pulled us in, but the people shaped the day.',
      photoTags: ['hiker', 'portrait', 'person', 'trail'],
    };
  }
  if (/river/.test(t)) {
    return {
      role: 'setup',
      headline: 'Jamaican river hikes hit different.',
      body: 'What looks refreshing in the photos usually means wet footing, changing terrain, and a very different kind of hike.',
      photoTags: ['river', 'water', 'rocks'],
    };
  }
  if (/body|health/.test(t)) {
    return {
      role: 'setup',
      headline: 'Hiking is more than a nice view.',
      body: 'A regular trail routine can work your heart, lungs, legs, balance and mood all at once.',
    };
  }
  if (/type|group|trusted|cannot be trusted/.test(t)) {
    return {
      role: 'setup',
      headline: 'Every hiking crew has familiar characters.',
      body: 'Once you spend enough time on trails, the personalities reveal themselves very quickly.',
    };
  }
  if (/before you hike/.test(t)) {
    return {
      role: 'setup',
      headline: 'A better hike starts before the first step.',
      body: 'Preparation shapes the experience long before you reach the trail itself.',
    };
  }
  if (/jamaica/.test(t)) {
    return {
      role: 'setup',
      headline: 'This side of Jamaica stays hidden to many people.',
      body: 'The island changes when you leave the main road and start paying attention to what the land is saying.',
    };
  }
  return {
    role: 'setup',
    headline: 'The walk is never just the walk.',
    body: 'The best Lifestyle Hikers stories usually begin with something ordinary and become something else along the way.',
  };
}

function buildDevBodies(
  concept: Concept,
  count: number,
  analyses: PhotoAnalysis[],
): Array<{ headline: string; body: string; photoTags?: string[] }> {
  const t = normalize(concept.title);
  if (/trail brought us together/.test(t)) {
    const availableTags = new Set(analyses.flatMap((analysis) => [...analysisTags(analysis)]));
    const hasRecognition = [...availableTags].some((tag) => /recognition|gift|presentation/.test(tag));
    const hasChildren = [...availableTags].some((tag) => /children|young hiker/.test(tag));
    const grounded = [
      { headline: 'Every view gave us a reason to pause.', body: 'Rock, river and mountain made the route memorable.', photoTags: ['scenic', 'river', 'mountain', 'rocks'] },
      { headline: 'Then the group became the story.', body: 'Different ages, different paces, one shared journey.', photoTags: ['group', 'community', 'hikers'] },
    ];
    if (hasRecognition) {
      grounded.push({ headline: 'We celebrate the people who show up.', body: 'A moment of appreciation can say a lot about community.', photoTags: ['recognition', 'gift', 'presentation', 'people'] });
    }
    if (hasChildren) {
      grounded.push({ headline: 'Young hikers bring big energy.', body: 'Their joy reminds us that adventure belongs to every generation.', photoTags: ['children', 'young hikers', 'celebration'] });
    }
    const generic = [
      { headline: 'Every pace had a place.', body: 'Moving together mattered more than arriving first.', photoTags: ['people', 'community', 'hikers'] },
      { headline: 'Shared moments became memories.', body: 'The small pauses and conversations gave the day its meaning.', photoTags: ['people', 'group', 'scenic'] },
    ];
    return [...grounded, ...generic].slice(0, count);
  }
  if (/6 stages of every river hike/.test(t) || /river hike/.test(t)) {
    return [
      { headline: 'Stage 1: Full confidence.', body: 'Everyone is fresh. The hike still feels easier in theory than it will in practice.', photoTags: ['people', 'hikers', 'group'] },
      { headline: 'Stage 2: First contact with the river.', body: 'The water changes the mood immediately. Temperature, footing and pace all shift at once.', photoTags: ['river', 'water'] },
      { headline: 'Stage 3: The rock test.', body: 'This is where balance starts to matter more than speed.', photoTags: ['rocks', 'hiker', 'person'] },
      { headline: 'Stage 4: The “almost there” phase.', body: 'Someone says it. Nobody fully believes them anymore.', photoTags: ['people', 'group', 'children'] },
    ].slice(0, count);
  }
  if (/what nobody tells you about hiking jamaican rivers/.test(t)) {
    return [
      { headline: 'The river controls the pace.', body: 'Crossings and wet terrain slow everyone down, no matter how strong they felt at the start.', photoTags: ['river', 'water', 'scenic'] },
      { headline: 'Grip matters more than style.', body: 'A pretty pair of shoes is useless when slippery rock becomes part of the trail.', photoTags: ['rocks', 'river', 'hiker'] },
      { headline: 'Dry does not stay dry.', body: 'Once the water becomes part of the route, planning around comfort becomes unrealistic.', photoTags: ['river', 'water'] },
      { headline: 'The reward comes with respect.', body: 'River hikes are beautiful because they demand attention, patience and humility.', photoTags: ['children', 'celebration', 'people', 'river'] },
    ].slice(0, count);
  }
  if (/body|health/.test(t)) {
    return [
      { headline: 'Your heart works harder.', body: 'Regular hiking can support cardiovascular health by training endurance across changing terrain.' },
      { headline: 'Your legs adapt.', body: 'Inclines, descents and uneven surfaces build useful lower-body strength.' },
      { headline: 'Your balance improves.', body: 'Trails force stabilizing muscles to do their job in ways flat ground does not.' },
      { headline: 'Your mind gets the benefit too.', body: 'Time outdoors is associated with lower stress and better mood for many people.' },
    ].slice(0, count);
  }
  if (/type|group|hiker/.test(t)) {
    return [
      { headline: 'The Navigator.', body: 'Usually confident. Sometimes correct. Always walking like they know exactly where this ends.' },
      { headline: 'The Motivator.', body: 'Keeps morale high and distance estimates suspiciously optimistic.' },
      { headline: 'The Photographer.', body: 'Sees a frame in everything and has the group waiting for one more shot.' },
      { headline: 'The Snack Carrier.', body: 'Quietly becomes everyone\'s favourite person at the hardest part of the trail.' },
    ].slice(0, count);
  }
  if (/before you hike/.test(t)) {
    return [
      { headline: 'Footwear comes first.', body: 'Grip and stability matter more than looking trail-ready.' },
      { headline: 'Hydration changes everything.', body: 'Jamaican heat can drain you long before you realise it.' },
      { headline: 'Weather is not background information.', body: 'Rain can reshape a route, especially around rivers and slippery sections.' },
      { headline: 'Go with people who know.', body: 'Experience, route knowledge and community make the trail better and safer.' },
    ].slice(0, count);
  }
  if (/jamaica/.test(t)) {
    return [
      { headline: 'The terrain keeps changing.', body: 'That unpredictability is part of what makes hiking Jamaica so memorable.' },
      { headline: 'The landscape tells a bigger story.', body: 'Rivers, ridges, caves, forest and coastline reveal a side of the island many people never meet.' },
      { headline: 'The people complete the experience.', body: 'It is never only about the destination. The shared effort matters too.' },
      { headline: 'Discovery changes your relationship to place.', body: 'Walking a landscape teaches things a windshield never will.' },
    ].slice(0, count);
  }
  return [
    { headline: 'The build-up.', body: 'What looked simple at first began to ask for more attention.' },
    { headline: 'The shift.', body: 'This is where the experience became bigger than the original plan.' },
    { headline: 'The discovery.', body: 'Something unexpected gave the hike its real meaning.' },
    { headline: 'The connection.', body: 'The place and the people started to feel inseparable.' },
  ].slice(0, count);
}

function createPayoff(concept: Concept): SlideBlueprint {
  const t = normalize(concept.title);
  if (/trail brought us together/.test(t)) {
    return {
      role: 'payoff',
      headline: 'The best reward is who you share it with.',
      body: 'The photos carry the landscape. The memories carry the people.',
      photoTags: ['recognition', 'gift', 'celebration', 'children'],
    };
  }
  if (/river/.test(t)) {
    return {
      role: 'payoff',
      headline: 'This is why the river is worth it.',
      body: 'The beauty is real. So is the effort it takes to reach it.',
      photoTags: ['river', 'water', 'scenic'],
    };
  }
  if (/body|health/.test(t)) {
    return {
      role: 'payoff',
      headline: 'Your body keeps the score.',
      body: 'Every climb, crossing and descent contributes to the bigger picture over time.',
    };
  }
  if (/type|group|hiker/.test(t)) {
    return {
      role: 'payoff',
      headline: 'You know exactly who these people are.',
      body: 'And if you hike enough, you know which one sounds the most like you.',
    };
  }
  if (/jamaica/.test(t)) {
    return {
      role: 'payoff',
      headline: 'This is the Jamaica many people miss.',
      body: 'It does not disappear. Most people simply never walk far enough to meet it.',
    };
  }
  return {
    role: 'payoff',
    headline: 'This is why we keep showing up.',
    body: 'The payoff is never only scenic. It is also the feeling of having earned the moment.',
  };
}

function createTakeaway(concept: Concept): SlideBlueprint {
  const t = normalize(concept.title);
  if (/trail brought us together/.test(t)) {
    return {
      role: 'takeaway',
      headline: 'This is what community looks like.',
      body: 'Showing up, moving together and making room for everyone.',
      photoTags: ['group', 'community', 'people', 'hikers'],
    };
  }
  if (/what nobody tells you about hiking jamaican rivers/.test(t)) {
    return {
      role: 'takeaway',
      headline: 'Respect the river and enjoy the hike more.',
      body: 'Preparation, footwear and patience matter just as much as excitement.',
    };
  }
  if (/6 stages of every river hike/.test(t)) {
    return {
      role: 'takeaway',
      headline: 'Every river hike follows a pattern.',
      body: 'Confidence, discomfort, adaptation and payoff tend to arrive in that order.',
    };
  }
  if (/body|health/.test(t)) {
    return {
      role: 'takeaway',
      headline: 'Consistency matters more than perfection.',
      body: 'Regular movement can support strength, endurance and wellbeing. Hike within your limits.',
    };
  }
  if (/type|group|hiker/.test(t)) {
    return {
      role: 'takeaway',
      headline: 'The people are part of the trail story.',
      body: 'Shared personalities and shared struggle are a big part of what keeps hiking fun.',
    };
  }
  if (/jamaica/.test(t)) {
    return {
      role: 'takeaway',
      headline: 'Jamaica always gets bigger on foot.',
      body: 'The island reveals more when you move through it slowly and with intention.',
    };
  }
  return {
    role: 'takeaway',
    headline: 'The lesson is usually in the middle.',
    body: 'Not just at the destination.',
  };
}

function createCta(concept: Concept): SlideBlueprint {
  if (concept.pillar === 'Practical Guides') {
    return {
      role: 'cta',
      headline: 'SAVE THIS HIKE.',
      body: 'Save this for later and follow @LifestyleHikers for more Jamaican trail guidance.',
    };
  }
  if (concept.pillar === 'Relatable Hiking') {
    return {
      role: 'cta',
      headline: 'WHICH ONE IS YOU?',
      body: 'Tag your hiking crew and follow @LifestyleHikers. One foot in front the other.',
    };
  }
  return {
    role: 'cta',
    headline: 'WALK WITH US.',
    body: 'Follow @LifestyleHikers. One foot in front the other.',
    photoTags: ['scenic', 'river', 'mountain', 'trail'],
  };
}
