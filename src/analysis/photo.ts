// Photo analysis: scene + technical + camera/lens inference.
// Deterministic, locally-adaptive, no external AI required.

import sharp from 'sharp';
import type { CameraAnalysis, PhotoAnalysis, EnhancementProfile } from '../lib/types';

const LANDSCAPE_HINTS: Array<[string, RegExp]> = [
  ['mountain', /mountain|peak|ridge|summit|hill|elevation/i],
  ['forest', /forest|woodland|tree|jungle|canopy/i],
  ['river', /river|stream|creek/i],
  ['waterfall', /waterfall|cascade|falls/i],
  ['cave', /cave|grotto|cavern/i],
  ['coast', /coast|beach|shore|sea|ocean|mangrove/i],
  ['trail', /trail|path|track|road|bridge/i],
  ['rocks', /rock|boulder|cliff|gorge|canyon/i],
  ['vegetation', /fern|bamboo|moss|plant|flower|leaf/i],
];

const SUBJECT_HINTS: Array<[string, RegExp]> = [
  ['children', /kid|child|children|youth|young[-_ ]?hiker/i],
  ['celebration', /celebrat|cheer|victory|reward/i],
  ['recognition', /gift|present(?:ation)?|award|hamper|recognition/i],
  ['gift', /gift|hamper/i],
  ['group', /group|gathering|crew|team|community/i],
  ['hikers', /hiker|hiking|trail[-_ ]?group/i],
  ['portrait', /portrait|selfie|headshot/i],
  ['person', /person|people|man|woman|portrait|selfie/i],
];

function matchHints(text: string): string[] {
  const out: string[] = [];
  for (const [label, re] of LANDSCAPE_HINTS) {
    if (re.test(text)) out.push(label);
  }
  return out;
}

export function inferFilenameSubjects(filename: string): { subjects: string[]; peopleCount: number; faces: number } {
  const subjects = SUBJECT_HINTS.filter(([, pattern]) => pattern.test(filename)).map(([label]) => label);
  const hasPeopleSignal = subjects.some((subject) => ['children', 'group', 'hikers', 'portrait', 'person', 'recognition', 'gift'].includes(subject));
  if (hasPeopleSignal && !subjects.includes('people')) subjects.push('people');
  if (subjects.includes('children') && !subjects.includes('young hikers')) subjects.push('young hikers');
  if (subjects.includes('recognition') && !subjects.includes('community')) subjects.push('community');
  if (subjects.includes('group') && !subjects.includes('community')) subjects.push('community');

  let peopleCount = 0;
  if (subjects.includes('group')) peopleCount = 5;
  else if (subjects.includes('children') || subjects.includes('recognition')) peopleCount = 2;
  else if (hasPeopleSignal) peopleCount = 1;

  return {
    subjects: [...new Set(subjects)],
    peopleCount,
    faces: peopleCount,
  };
}

export function inferLandscape(dominantColors: string[], stats: sharp.Stats): string[] {
  // Heuristic: green dominance → vegetation/forest; blue dominance → water/coast; warm → coast/sunset.
  const tags: string[] = [];
  const ch = stats.channels;
  const [r, g, b] = [ch[0]?.mean ?? 0, ch[1]?.mean ?? 0, ch[2]?.mean ?? 0];
  if (g > r + 8 && g > b + 8) tags.push('vegetation', 'forest');
  if (b > r + 8 && b > g - 4) tags.push('water');
  if (r > g + 15 && r > b + 15) tags.push('warm light');
  if (stats.channels.length >= 3 && g < 60 && b < 60 && r < 60) tags.push('low light');
  return [...new Set(tags)];
}

export function inferCamera(stats: sharp.Stats, tags: string[]): CameraAnalysis {
  const stdev = stats.channels[0]?.stdev ?? 50;
  const mean = stats.channels[0]?.mean ?? 128;
  let cameraClass = 'Flagship full-frame mirrorless';
  let exampleSystems = ['Sony A7 series', 'Canon R5', 'Nikon Z8'];
  let lens = '24–70mm f/2.8';

  if (tags.includes('waterfall') || tags.includes('river')) {
    lens = '16–35mm f/2.8';
    cameraClass = 'High-resolution landscape camera';
    exampleSystems = ['Sony A7R V', 'Nikon Z7 II', 'Fujifilm GFX'];
  } else if (tags.includes('mountain') || tags.includes('coast')) {
    lens = '14–24mm f/2.8 or 16–35mm f/2.8';
    cameraClass = 'High-resolution landscape camera';
    exampleSystems = ['Sony A7R V', 'Hasselblad X2D', 'Fujifilm GFX'];
  } else if (tags.includes('low light')) {
    cameraClass = 'Professional low-light camera';
    exampleSystems = ['Sony A7S III', 'Canon R6 II', 'Nikon Z6 III'];
    lens = '24–70mm f/2.8';
  } else if (mean > 175) {
    cameraClass = 'Flagship full-frame mirrorless';
    lens = '24–70mm f/2.8';
  }

  return {
    cameraClass,
    exampleSystems,
    lens,
    aperture: tags.includes('low light') ? 'f/1.8–f/2.8' : 'f/5.6–f/8',
    shutterSpeed: tags.includes('waterfall') ? '1/15–1/60s (water motion)' : '1/250–1/2000s',
    iso: mean < 80 ? 'ISO 800–3200' : 'ISO 100–400',
    whiteBalance: 'Daylight ~5500K',
    focusBehavior: 'Continuous AF / eye-detect for people; single-point for landscape',
  };
}

export function analyzePhoto(
  src: Buffer,
  filename: string,
  profile: EnhancementProfile,
  asset: { width: number; height: number; orientation: string },
): PhotoAnalysis {
  // Derive stats synchronously is not available; use async wrapper in caller.
  // This function assumes stats were computed and passed indirectly.
  throw new Error('Use analyzePhotoAsync');
}

export async function analyzePhotoAsync(
  src: Buffer,
  filename: string,
  profile: EnhancementProfile,
  asset: { width: number; height: number; orientation: string },
): Promise<PhotoAnalysis> {
  const img = sharp(src, { failOn: 'none' });
  const meta = await img.metadata();
  const stats = await img.stats();
  const dominantColors = await dominantColorsAsync(src);

  const nameHints = matchHints(filename);
  const subjectHints = inferFilenameSubjects(filename);
  const colorLandscape = inferLandscape(dominantColors, stats);
  const landscape = [...new Set([...nameHints, ...colorLandscape])];
  const subjects = [...new Set([...subjectHints.subjects, ...landscape])];

  const mean = stats.channels[0]?.mean ?? 128;
  const timeOfDay =
    mean > 170 ? 'daytime / bright' : mean < 80 ? 'low light / dusk-dawn' : 'daytime';

  return {
    assetId: '',
    subjects: subjects.length ? subjects : ['scene'],
    peopleCount: subjectHints.peopleCount,
    faces: subjectHints.faces,
    landscape,
    terrain: landscape.filter((t) => ['mountain', 'forest', 'cave', 'coast', 'trail'].includes(t)),
    water: landscape.filter((t) => ['river', 'waterfall', 'coast', 'water'].includes(t)),
    weather: mean < 90 ? ['overcast / low light'] : ['clear'],
    lighting: mean < 80 ? 'soft / diffused' : 'natural daylight',
    timeOfDay,
    dominantColors,
    negativeSpace: stats.channels[0]?.stdev < 40 ? 'high' : stats.channels[0]?.stdev > 70 ? 'low' : 'medium',
    focalPoint: { x: 0.5, y: 0.45 },
    orientation: asset.orientation as 'landscape' | 'portrait' | 'square',
    technical: {
      exposure: mean < 70 ? 'underexposed' : mean > 175 ? 'overexposed' : 'balanced',
      dynamicRange: stats.channels[0]?.stdev > 60 ? 'wide' : 'moderate',
      sharpness: stats.channels[0]?.stdev > 55 ? 'good' : 'soft',
      motionBlur: 'none detected',
      noise: mean < 80 ? 'present' : 'low',
      whiteBalance: 'neutral',
      contrast: stats.channels[0]?.stdev > 60 ? 'strong' : 'moderate',
      haze: mean > 150 ? 'possible haze' : 'clear',
    },
    camera: inferCamera(stats, landscape),
    enhancement: { ...profile },
    qaConfidence: 1,
    tags: [...new Set([...landscape, ...subjectHints.subjects])],
  };
}

// Sample the image at low resolution to derive dominant color names deterministically.
async function dominantColorsAsync(src: Buffer): Promise<string[]> {
  try {
    const { data, info } = await sharp(src)
      .resize(32, 32, { fit: 'fill' })
      .raw()
      .toBuffer({ resolveWithObject: true });

    const { channels } = info;
    const buckets: Record<string, number> = {};
    const total = data.length / channels;

    for (let i = 0; i < total; i++) {
      const r = data[i * channels];
      const g = data[i * channels + 1];
      const b = data[i * channels + 2];
      const key = colorName(r, g, b);
      buckets[key] = (buckets[key] ?? 0) + 1;
    }

    return Object.entries(buckets)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([name]) => name);
  } catch {
    return [];
  }
}

function colorName(r: number, g: number, b: number): string {
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  if (mx < 40) return 'dark / black';
  if (mn > 200) return 'white / bright';
  if (r > g + 20 && r > b + 20) return 'warm / earthy tones';
  if (g > r + 10 && g > b + 10) return 'green';
  if (b > r + 10 && b > g + 5) return 'blue';
  if (r > 150 && g > 120 && b < 120) return 'golden';
  return 'neutral';
}
