// Safety engine: detect risky visual contexts and provide appropriate safety context.
// Research/QA: separate verified fact from observation/opinion/anecdote.

import type { PhotoAnalysis } from '../lib/types';

export interface SafetyFlag {
  context: string;
  level: 'info' | 'caution' | 'warning';
  note: string;
}

export function detectSafetyContexts(analyses: PhotoAnalysis[]): SafetyFlag[] {
  const flags: SafetyFlag[] = [];
  const allTags = analyses.flatMap((a) => [...a.landscape, ...a.tags]);

  if (allTags.some((t) => /waterfall/.test(t))) {
    flags.push({
      context: 'waterfall',
      level: 'caution',
      note: 'Waterfalls mean slippery rocks and strong currents. Keep a safe distance and never climb wet surfaces.',
    });
  }
  if (allTags.some((t) => /river|water/.test(t))) {
    flags.push({
      context: 'river crossing',
      level: 'caution',
      note: 'Check depth and current before crossing. Afternoon rain can raise rivers quickly.',
    });
  }
  if (allTags.some((t) => /cave/.test(t))) {
    flags.push({
      context: 'cave',
      level: 'caution',
      note: 'Caves can be dark, slick, and unstable. Never enter without a guide and proper lighting.',
    });
  }
  if (allTags.some((t) => /mountain|steep|ridge|cliff/.test(t))) {
    flags.push({
      context: 'steep terrain',
      level: 'caution',
      note: 'Steep descents and cliffs require caution. Stay on marked trails and watch your footing.',
    });
  }
  if (analyses.some((a) => a.technical?.exposure === 'overexposed' && a.timeOfDay === 'daytime / bright')) {
    flags.push({
      context: 'heat',
      level: 'info',
      note: 'Bright conditions suggest heat — carry water, wear sun protection, and hike early or late.',
    });
  }

  return flags;
}

export interface FactCheck {
  claim: string;
  kind: 'verified-fact' | 'observation' | 'opinion' | 'anecdote';
  note: string;
}

/**
 * Classifies factual claims to clearly separate verified fact from observation/opinion/anecdote.
 * Where an external research provider is configured, it would be called here; the deterministic
 * fallback marks health/geo claims as "verified-fact" only when they are defensible, otherwise
 * flags them as needing verification.
 */
export function classifyClaims(text: string): FactCheck[] {
  const out: FactCheck[] = [];
  const claims = text.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 8);

  for (const claim of claims) {
    const c = claim.trim();
    if (/can support|is associated with|may improve|contributes to/.test(c)) {
      out.push({ claim: c, kind: 'verified-fact', note: 'Defensible health wording used.' });
    } else if (/guarantee|always|never|cure|treat|burn \d+ calories/.test(c)) {
      out.push({ claim: c, kind: 'opinion', note: 'Potentially unverifiable or exaggerated — consider softening.' });
    } else if (/we |i |our |my |i'm |we're |we'll /i.test(c)) {
      out.push({ claim: c, kind: 'anecdote', note: 'Personal/group experience.' });
    } else if (/parish|river|mountain|cave|trail|island|endemic|species/.test(c)) {
      out.push({ claim: c, kind: 'observation', note: 'May contain a factual claim — verify against a reliable source before publishing.' });
    }
  }
  return out;
}
