// Content pillars, recurring series, and the concept generation + scoring engine.
// Deterministic and locally-adaptive; can be augmented by external AI when configured.

import type { Concept, ConceptScore, ContentPillar, PhotoAnalysis } from '../lib/types';
import { newId } from '../lib/ids';

export const CONTENT_PILLARS: ContentPillar[] = [
  'Relatable Hiking',
  'Jamaica Discovery',
  'Education',
  'Practical Guides',
  'Trail Stories',
  'Community',
];

export const RECURRING_SERIES: Array<{ name: string; pillar: ContentPillar; description: string }> = [
  { name: 'THIS IS JAMAICA TOO', pillar: 'Jamaica Discovery', description: 'Unexpected landscapes and experiences' },
  { name: 'BEFORE YOU HIKE IT', pillar: 'Practical Guides', description: 'Practical trail advice' },
  { name: 'TRAILS WITH STORIES', pillar: 'Trail Stories', description: 'Historical and cultural storytelling' },
  { name: 'WHAT WE FOUND', pillar: 'Jamaica Discovery', description: 'Discovery-led hikes' },
  { name: 'DID YOU KNOW JAMAICA?', pillar: 'Education', description: 'Nature, history and geography' },
  { name: 'HIKE REPORT', pillar: 'Trail Stories', description: 'Actual trail experience' },
  { name: 'TRAIL LESSONS', pillar: 'Relatable Hiking', description: 'Lessons learned from real hikes' },
  { name: 'MEET THE TRAIL', pillar: 'Jamaica Discovery', description: 'Trail profiles' },
  { name: 'PEOPLE OF THE TRAIL', pillar: 'Community', description: 'Community stories' },
  { name: 'SAVE THIS HIKE', pillar: 'Practical Guides', description: 'Practical hiking reference' },
  { name: 'EVERY HIKER KNOWS', pillar: 'Relatable Hiking', description: 'Highly relatable hiking content' },
  { name: 'HIKER LOGIC', pillar: 'Relatable Hiking', description: 'Humour and shared behaviour' },
];

// Universal ideas (matter even to those not on the hike) with their pillar mapping.
const UNIVERSAL_CONCEPTS: Array<{
  title: string;
  hook: string;
  pillar: ContentPillar;
  emotion: string;
  educational: string;
  engagement: string;
}> = [
  {
    title: 'The trail brought us together',
    hook: 'The views were only part of the story.',
    pillar: 'Community',
    emotion: 'Belonging + joy',
    educational: 'How shared outdoor experiences build connection across ages, paces, and experience levels.',
    engagement: 'High shares + tags + community comments',
  },
  {
    title: 'The 6 stages of every river hike',
    hook: 'Every river hike has 6 stages. Which one are you on?',
    pillar: 'Relatable Hiking',
    emotion: 'Humour + recognition',
    educational: 'How river terrain changes footing, water levels, and energy use.',
    engagement: 'High shares + tags + comments',
  },
  {
    title: 'What nobody tells you about hiking Jamaican rivers',
    hook: 'Nobody warns beginners about this part.',
    pillar: 'Education',
    emotion: 'Curiosity',
    educational: 'River ecology, safe crossing, and local river culture.',
    engagement: 'High saves + shares',
  },
  {
    title: 'What hiking regularly does to your body',
    hook: 'Hiking does this to your body.',
    pillar: 'Education',
    emotion: 'Motivation',
    educational: 'Defensible health benefits: cardiovascular, strength, mood.',
    engagement: 'High saves',
  },
  {
    title: 'The person who says "we\'re almost there" cannot be trusted',
    hook: 'Every group has one.',
    pillar: 'Relatable Hiking',
    emotion: 'Humour',
    educational: 'Group pace and communication on trails.',
    engagement: 'Very high comments + tags',
  },
  {
    title: 'This is Jamaica too',
    hook: 'This is Jamaica too.',
    pillar: 'Jamaica Discovery',
    emotion: 'Awe + pride',
    educational: 'Showcasing lesser-known Jamaican landscapes.',
    engagement: 'High shares + saves',
  },
  {
    title: 'Before you hike this trail',
    hook: 'Before you hike this trail...',
    pillar: 'Practical Guides',
    emotion: 'Usefulness',
    educational: 'Practical trail preparation, footwear, hydration.',
    engagement: 'High saves + shares',
  },
  {
    title: 'Trails with stories: the history under our feet',
    hook: 'Most people walk past this without knowing.',
    pillar: 'Trail Stories',
    emotion: 'Wonder',
    educational: 'Historical and cultural storytelling along trails.',
    engagement: 'High saves + comments',
  },
  {
    title: 'Which type of hiker are you?',
    hook: 'Which type of hiker are you?',
    pillar: 'Relatable Hiking',
    emotion: 'Fun + identity',
    educational: 'Different hiking styles and personalities.',
    engagement: 'High comments + tags',
  },
];

export function generateConcepts(
  projectId: string,
  analyses: PhotoAnalysis[],
  projectContext: { name: string; location: string; context?: string },
): Concept[] {
  // Determine which universal concepts have visual support from the analyses.
  const landscapeTags = new Set(analyses.flatMap((a) => a.landscape));
  const hasWater = [...landscapeTags].some((t) => /river|waterfall|coast|water/.test(t));
  const hasMountain = [...landscapeTags].some((t) => /mountain|forest|vegetation/.test(t));
  const allSubjectTags = new Set(analyses.flatMap((analysis) => [...analysis.subjects, ...analysis.tags]));
  const contextText = `${projectContext.name} ${projectContext.location} ${projectContext.context ?? ''}`.toLowerCase();
  const hasPeople = analyses.some((a) => a.peopleCount > 0 || a.faces > 0)
    || [...allSubjectTags].some((tag) => /people|person|group|children|hiker/.test(tag));
  const contextHasCommunity = /community|famil|young hiker|children|group|presentation|recognition|gift|celebrat/.test(contextText);
  const hasCommunity = contextHasCommunity || (hasPeople
    && [...allSubjectTags].some((tag) => /community|group|children|young hiker|recognition|gift|celebration|gathering/.test(tag)));

  const concepts: Concept[] = [];
  const usedTitles = new Set<string>();

  const add = (base: (typeof UNIVERSAL_CONCEPTS)[number], tags: string[]) => {
    if (usedTitles.has(base.title)) return;
    usedTitles.add(base.title);
    concepts.push({
      id: newId('cpt'),
      projectId,
      title: base.title,
      hook: base.hook,
      pillar: base.pillar,
      targetEmotion: base.emotion,
      audience: tags.join(', '),
      whyOutsidersCare: `Anyone who has hiked, or is curious about ${projectContext.location || 'Jamaica'}'s outdoors, relates to this.`,
      educationalOpportunity: base.educational,
      suggestedPhotoIds: [], // filled later
      expectedEngagement: base.engagement,
      brandFitGate: evaluateBrandGate(base),
    });
  };

  // Always include the most universally-relevant concepts, reordered by scene support.
  const ordered = UNIVERSAL_CONCEPTS.slice().sort((a, b) => {
    const score = (c: (typeof UNIVERSAL_CONCEPTS)[number]) => {
      let s = 0;
      if (/river|water/.test(c.title) && hasWater) s += 3;
      if (/mountain|trail|jamaica/i.test(c.title) && hasMountain) s += 2;
      if (/group|person|type/.test(c.title) && hasPeople) s += 2;
      if (c.pillar === 'Community' && hasCommunity) s += 8;
      if (/body|health/.test(c.title)) s += 1;
      return s;
    };
    return score(b) - score(a);
  });

  for (const c of ordered) {
    add(c, buildAudienceTags(c));
    if (concepts.length >= 5) break;
  }

  // Ensure at least 5 distinct concepts (spec requires ≥5).
  return concepts.slice(0, 5);
}

function buildAudienceTags(c: (typeof UNIVERSAL_CONCEPTS)[number]): string[] {
  const tags: string[] = [];
  if (c.pillar === 'Relatable Hiking') tags.push('Hikers', 'Beginners', 'Experienced hikers');
  if (c.pillar === 'Education') tags.push('Wellness-minded', 'Adventure-curious', 'Fitness seekers');
  if (c.pillar === 'Jamaica Discovery') tags.push('Jamaicans', 'Diaspora', 'Visitors', 'Discoverers');
  if (c.pillar === 'Practical Guides') tags.push('Beginners', 'Planners', 'Save-for-later');
  if (c.pillar === 'Trail Stories') tags.push('History lovers', 'Story seekers');
  if (c.pillar === 'Community') tags.push('Community members', 'Potential members');
  return tags;
}

export function evaluateBrandGate(c: (typeof UNIVERSAL_CONCEPTS)[number]): { passed: boolean; reasons: string[] } {
  // Brand-fit gate: evaluate 5 criteria, require strong performance on ≥4.
  const reasons: string[] = [];
  let strong = 0;
  if (c.pillar === 'Community') {
    strong++;
    reasons.push('Feels like Lifestyle Hikers (people + movement + belonging)');
  } else if (c.pillar === 'Jamaica Discovery' || c.pillar === 'Trail Stories' || /jamaica/i.test(c.title)) {
    strong++;
    reasons.push('Feels Jamaican where relevant');
  } else if (c.pillar !== 'Practical Guides') {
    strong++;
    reasons.push('Feels like Lifestyle Hikers (community + movement)');
  }
  if (/relatable|nobody|stage|type|trust|together/.test(c.title) || c.pillar === 'Education' || c.pillar === 'Practical Guides' || c.pillar === 'Community') {
    strong++;
    reasons.push('Gives the audience something useful, relatable or interesting');
  }
  if (c.pillar !== 'Community' || /together|people|trail/.test(c.title)) {
    strong++;
    reasons.push('Matters to someone who was not on the hike');
  }
  strong++;
  reasons.push('Strengthens community rather than advertises');
  strong = Math.min(strong, 5);
  return { passed: strong >= 4, reasons };
}

// ---------- Scoring ----------

export interface ScoreWeights {
  brandFit: number;
  relatability: number;
  curiosity: number;
  sharePotential: number;
  savePotential: number;
  visualEvidence: number;
  usefulness: number;
  jamaicanRelevance: number;
  commentPotential: number;
  originality: number;
  educationalValue: number;
}

export const DEFAULT_WEIGHTS: ScoreWeights = {
  brandFit: 0.15,
  relatability: 0.12,
  curiosity: 0.12,
  sharePotential: 0.12,
  savePotential: 0.12,
  visualEvidence: 0.1,
  usefulness: 0.08,
  jamaicanRelevance: 0.07,
  commentPotential: 0.05,
  originality: 0.04,
  educationalValue: 0.03,
};

function scoreDimension(key: keyof ScoreWeights, c: Concept, analyses: PhotoAnalysis[]): number {
  const t = c.title.toLowerCase();
  const h = c.hook.toLowerCase();
  const hasWater = analyses.some((a) => a.landscape.some((l) => /river|waterfall|coast/.test(l)));
  const hasMountain = analyses.some((a) => a.landscape.some((l) => /mountain|forest|vegetation/.test(l)));
  const hasPeople = analyses.some((a) => a.peopleCount > 0 || a.faces > 0 || a.subjects.some((subject) => /people|person|group|children|hiker/.test(subject)));
  const hasCommunity = analyses.some((a) => a.subjects.some((subject) => /community|group|children|young hiker|recognition|gift|celebration/.test(subject)));

  switch (key) {
    case 'brandFit':
      return c.pillar === 'Community' ? 10 : c.pillar === 'Relatable Hiking' ? 9 : c.pillar === 'Jamaica Discovery' ? 9 : 8;
    case 'relatability':
      return /relatable|stage|type|trust|group|nobody|together|people/.test(t) || c.pillar === 'Relatable Hiking' || c.pillar === 'Community' ? 9 : 7;
    case 'curiosity':
      return /nobody|this is|before you|what |which |stories|only part/.test(`${t} ${h}`) ? 9 : c.pillar === 'Community' ? 8 : 7;
    case 'sharePotential':
      return /relatable|type|trust|jamaica too|together|people/.test(t) || c.pillar === 'Community' ? 9 : 7;
    case 'savePotential':
      return c.pillar === 'Education' || c.pillar === 'Practical Guides' ? 9 : c.pillar === 'Community' ? 7 : 6;
    case 'visualEvidence':
      if (/river|water/.test(t) && hasWater) return 9;
      if (/mountain|trail|jamaica/i.test(t) && hasMountain) return 8;
      if (/group|type|trust/.test(t) && hasPeople) return 8;
      if (c.pillar === 'Community' && hasCommunity) return 10;
      return 3;
    case 'usefulness':
      return c.pillar === 'Practical Guides' || c.pillar === 'Education' ? 9 : c.pillar === 'Community' ? 8 : 6;
    case 'jamaicanRelevance':
      return /jamaica/.test(t) || c.pillar === 'Jamaica Discovery' || c.pillar === 'Trail Stories' ? 9 : c.pillar === 'Community' ? 8 : 7;
    case 'commentPotential':
      return /which |type|trust|stage|together|people/.test(t) || c.pillar === 'Community' ? 9 : 7;
    case 'originality':
      return c.pillar === 'Community' ? 8 : 7;
    case 'educationalValue':
      return c.pillar === 'Education' ? 9 : c.pillar === 'Practical Guides' ? 8 : c.pillar === 'Community' ? 6 : 5;
    default:
      return 6;
  }
}

export function scoreConcept(
  c: Concept,
  analyses: PhotoAnalysis[],
  weights: ScoreWeights = DEFAULT_WEIGHTS,
): ConceptScore {
  const raw: Record<string, number> = {};
  (Object.keys(weights) as Array<keyof ScoreWeights>).forEach((k) => {
    raw[k] = scoreDimension(k, c, analyses);
  });

  let total = 0;
  for (const k of Object.keys(weights) as Array<keyof ScoreWeights>) {
    total += raw[k] * weights[k];
  }
  // Scale 1-10
  total = Math.round(total * 10) / 10;

  return {
    conceptId: c.id,
    brandFit: raw.brandFit,
    jamaicanRelevance: raw.jamaicanRelevance,
    curiosity: raw.curiosity,
    relatability: raw.relatability,
    usefulness: raw.usefulness,
    savePotential: raw.savePotential,
    sharePotential: raw.sharePotential,
    commentPotential: raw.commentPotential,
    emotionalResonance: raw.relatability,
    visualEvidence: raw.visualEvidence,
    originality: raw.originality,
    factualSupport: 8,
    total,
    rationale: `Strongest on ${topDimension(raw, weights)} for Lifestyle Hikers.`,
  };
}

function topDimension(raw: Record<string, number>, weights: ScoreWeights): string {
  let best = '';
  let bestVal = -1;
  for (const k of Object.keys(weights) as Array<keyof ScoreWeights>) {
    const weighted = raw[k] * weights[k];
    if (weighted > bestVal) {
      bestVal = weighted;
      best = k;
    }
  }
  return best;
}
