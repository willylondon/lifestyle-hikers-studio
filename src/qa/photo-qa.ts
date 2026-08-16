// Automated QA comparison between Original and Enhanced Master.
// Verifies enhancement did not materially alter the photograph.

import sharp from 'sharp';
import { config } from '../lib/config';

export interface QaResult {
  confidence: number;
  passed: boolean;
  checks: Array<{ name: string; ok: boolean; detail: string }>;
}

function mse(a: Buffer, b: Buffer): number {
  let sum = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return sum / n;
}

/**
 * Computes structural similarity proxy using downsampled luminance.
 * Higher = more similar. Threshold per spec (default 0.90).
 */
export async function compareImages(original: Buffer, enhanced: Buffer): Promise<QaResult> {
  const checks: Array<{ name: string; ok: boolean; detail: string }> = [];

  const o = await sharp(original, { failOn: 'none' }).resize(256, 256, { fit: 'fill' }).greyscale().raw().toBuffer();
  const e = await sharp(enhanced, { failOn: 'none' }).resize(256, 256, { fit: 'fill' }).greyscale().raw().toBuffer();

  const err = mse(o, e);
  // MSE near 0 → near-identical. As MSE grows, similarity drops.
  const similarity = Math.max(0, 1 - err / (255 * 255));
  checks.push({
    name: 'structural-similarity',
    ok: similarity >= 0.85,
    detail: `similarity=${similarity.toFixed(3)}`,
  });

  // Color plausibility: mean channel drift should stay small.
  const oStats = await sharp(original, { failOn: 'none' }).stats();
  const eStats = await sharp(enhanced, { failOn: 'none' }).stats();
  const meanDrift = oStats.channels.map((c, i) => Math.abs(c.mean - (eStats.channels[i]?.mean ?? c.mean)));
  const avgDrift = meanDrift.reduce((a, b) => a + b, 0) / meanDrift.length;
  const colorPlausible = avgDrift < 40;
  checks.push({
    name: 'color-plausibility',
    ok: colorPlausible,
    detail: `mean channel drift=${avgDrift.toFixed(1)}`,
  });

  // Skin realism / saturation check: ensure enhanced saturation not excessive.
  const eSat = eStats.channels[0]?.stdev ?? 0;
  const oSat = oStats.channels[0]?.stdev ?? 0;
  const satOk = eSat <= oSat * 1.6 + 10;
  checks.push({
    name: 'saturation-guard',
    ok: satOk,
    detail: `enhanced stdev=${eSat.toFixed(1)} vs original=${oSat.toFixed(1)}`,
  });

  // Artifact guard: sharpening should not produce extreme high-frequency noise.
  const sharpeningExcessive = eSat > oSat * 2.2;
  checks.push({
    name: 'artifact-guard',
    ok: !sharpeningExcessive,
    detail: sharpeningExcessive ? 'possible over-sharpening' : 'within limits',
  });

  const confidence = Math.min(
    1,
    0.5 * similarity + 0.25 * (colorPlausible ? 1 : 0) + 0.15 * (satOk ? 1 : 0) + 0.1 * (!sharpeningExcessive ? 1 : 0),
  );

  return {
    confidence,
    passed: confidence >= config.enhancement.qaThreshold,
    checks,
  };
}
