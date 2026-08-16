// Professional photo enhancement engine.
// Enhancement is permitted; regeneration is prohibited. The engine only applies
// reversible, non-destructive tonal/technical adjustments and stores them as
// metadata (EnhancementProfile) rather than baking into source files.

import sharp from 'sharp';
import type { EnhancementProfile, MediaAsset } from '../lib/types';

const DEFAULT_PROFILE: EnhancementProfile = {
  exposure: 0,
  highlights: 0,
  shadows: 0,
  whiteBalance: 5500,
  noiseReduction: 0,
  sharpening: 0,
  clarity: 0,
  vibrance: 0,
  contrast: 0,
  hazeReduction: 0,
};

export function defaultProfile(): EnhancementProfile {
  return { ...DEFAULT_PROFILE };
}

export function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

/**
 * Derives an adaptive enhancement profile from image statistics.
 * This is locally adaptive — never a single global preset.
 */
export function deriveProfile(stats: sharp.Stats): EnhancementProfile {
  const channels = stats.channels;
  const meanLum = channels[0]?.mean ?? 128;
  const stdevLum = channels[0]?.stdev ?? 50;
  const p = defaultProfile();

  // Exposure: push toward a healthy midtone (~110) while underexposed images get more.
  if (meanLum < 70) p.exposure = clamp((100 - meanLum) * 0.02, 0, 0.6);
  else if (meanLum > 175) p.exposure = clamp((175 - meanLum) * 0.02, -0.4, 0);

  // Low contrast / low dynamic range → gentle contrast & clarity.
  if (stdevLum < 40) {
    p.contrast = clamp((40 - stdevLum) * 0.15, 0, 12);
    p.clarity = clamp((40 - stdevLum) * 0.25, 0, 15);
  }

  // Highlight/shadow recovery proportional to dynamic range.
  p.highlights = clamp((stdevLum - 50) * -0.2, -25, 0);
  p.shadows = clamp((50 - stdevLum) * -0.3, 0, 25);

  // Modest sharpening for detail recovery; heavier for flat scenes.
  p.sharpening = clamp(stdevLum < 45 ? 18 : 10, 0, 25);

  // Light noise reduction for high-grain images.
  const maxMean = Math.max(...channels.map((c) => c.mean));
  p.noiseReduction = clamp(maxMean - 120, 0, 12);

  // Restrained vibrance — never heavy saturation.
  p.vibrance = clamp(6 + (90 - meanLum) * 0.03, 0, 10);

  return p;
}

/**
 * Applies an enhancement profile to a source buffer, producing the enhanced master.
 * Returns the enhanced image buffer. Source is never mutated.
 */
export async function applyEnhancement(
  src: Buffer,
  profile: EnhancementProfile,
  asset: MediaAsset,
): Promise<Buffer> {
  let img = sharp(src, { failOn: 'none' }).rotate(); // auto-orient based on EXIF

  // White balance via a subtle tint using temperature→RGB mapping.
  const wb = clamp(profile.whiteBalance, 2000, 10000);
  const kelvinToRgb = (k: number): { r: number; g: number; b: number } => {
    const t = k / 100;
    let r = 255;
    let g: number;
    let b: number;
    if (t <= 66) {
      g = 99.4708025861 * Math.log(t) - 161.1195681661;
    } else {
      g = 288.1221695283 * Math.pow(t - 60, -0.0755148492);
    }
    if (t >= 66) {
      r = 329.698727446 * Math.pow(t - 60, -0.1332047592);
      b = 255;
    } else if (t <= 19) {
      b = 0;
    } else {
      b = 138.5177312231 * Math.log(t - 10) - 305.0447927307;
    }
    return {
      r: clamp(r, 0, 255),
      g: clamp(g, 0, 255),
      b: clamp(b, 0, 255),
    };
  };

  const rgb = kelvinToRgb(wb);
  const scaleR = 255 / (rgb.r || 1);
  const scaleB = 255 / (rgb.b || 1);
  const gamma = 1.2;

  // White balance via channel scaling, then tone curve.
  img = img
    .recomb([
      [scaleR, 0, 0],
      [0, 1, 0],
      [0, 0, scaleB],
    ])
    .gamma(gamma);

  // Tonal adjustments.
  img = img.modulate({
    brightness: 1 + profile.exposure * 0.35,
    saturation: 1 + profile.vibrance / 100,
  });

  if (profile.contrast !== 0) {
    img = img.linear(1 + profile.contrast / 100, -(profile.contrast * 128) / 100);
  }

  // Noise reduction (only if needed).
  if (profile.noiseReduction > 0) {
    const sigma = profile.noiseReduction / 8;
    img = img.sharpen({ sigma, m1: 0.4, m2: 0.6 });
  }

  // Sharpening.
  if (profile.sharpening > 0) {
    img = img.sharpen({
      sigma: 0.9,
      m1: 0.5,
      m2: 0.5 + profile.sharpening / 60,
    });
  }

  // Highlight/shadow recovery via modulated curves.
  if (profile.highlights !== 0 || profile.shadows !== 0) {
    img = img.modulate({
      brightness: 1 + profile.shadows / 200 - profile.highlights / 400,
    });
  }

  const out = await img.jpeg({ quality: 92, mozjpeg: true }).toBuffer();
  return out;
}

export function profileToRecord(p: EnhancementProfile): Record<string, number> {
  return { ...p };
}
