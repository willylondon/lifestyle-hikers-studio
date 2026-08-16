import type { PhotoAnalysis } from './types';

// Test helper to produce sample PhotoAnalysis objects.
export function generateConceptForTest(): PhotoAnalysis[] {
  return [
    makeAnalysis(['river', 'waterfall', 'vegetation']),
    makeAnalysis(['forest', 'mountain']),
    makeAnalysis(['trail', 'vegetation']),
  ];
}

function makeAnalysis(landscape: string[]): PhotoAnalysis {
  return {
    assetId: 'ast_1',
    subjects: ['scene'],
    peopleCount: 2,
    faces: 0,
    landscape,
    terrain: landscape.filter((t) => ['mountain', 'forest', 'cave', 'coast', 'trail'].includes(t)),
    water: landscape.filter((t) => ['river', 'waterfall', 'coast'].includes(t)),
    weather: ['clear'],
    lighting: 'natural daylight',
    timeOfDay: 'daytime',
    dominantColors: ['green', 'blue'],
    negativeSpace: 'medium',
    focalPoint: { x: 0.5, y: 0.45 },
    orientation: 'landscape',
    technical: {
      exposure: 'balanced',
      dynamicRange: 'moderate',
      sharpness: 'good',
      motionBlur: 'none detected',
      noise: 'low',
      whiteBalance: 'neutral',
      contrast: 'moderate',
      haze: 'clear',
    },
    camera: {
      cameraClass: 'Flagship full-frame mirrorless',
      exampleSystems: ['Sony A7 series'],
      lens: '24-70mm',
      aperture: 'f/8',
      shutterSpeed: '1/500s',
      iso: 'ISO 100',
      whiteBalance: 'Daylight',
      focusBehavior: 'Continuous AF',
    },
    enhancement: {
      exposure: 0.2,
      highlights: -10,
      shadows: 10,
      whiteBalance: 5500,
      noiseReduction: 5,
      sharpening: 12,
      clarity: 8,
      vibrance: 6,
      contrast: 5,
      hazeReduction: 0,
    },
    qaConfidence: 0.97,
    tags: [...landscape],
  };
}
