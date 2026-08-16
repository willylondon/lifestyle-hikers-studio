// Shared domain types for the Lifestyle Hikers Studio.

export type ApprovalStatus =
  | 'Draft'
  | 'Processing Media'
  // Legacy value retained so existing projects still render correctly.
  | 'AI Processing'
  | 'Needs Review'
  | 'Approved'
  | 'Scheduled'
  | 'Publishing'
  | 'Published'
  | 'Media Expired'
  | 'Failed';

export type ContentPillar =
  | 'Relatable Hiking'
  | 'Jamaica Discovery'
  | 'Education'
  | 'Practical Guides'
  | 'Trail Stories'
  | 'Community';

export type MediaKind = 'image' | 'video';

export type MediaState = 'original' | 'enhanced' | 'derivative';

export interface MediaAsset {
  id: string;
  projectId: string;
  sourceId: string; // e.g. LH-2026-HEINEKEN-001
  kind: MediaKind;
  mimeType: string;
  filename: string;
  width: number;
  height: number;
  orientation: 'landscape' | 'portrait' | 'square';
  bytes: number;
  createdAt: string;
}

export interface EnhancementProfile {
  exposure: number;
  highlights: number;
  shadows: number;
  whiteBalance: number;
  noiseReduction: number;
  sharpening: number;
  clarity: number;
  vibrance: number;
  contrast: number;
  hazeReduction: number;
}

export interface CameraAnalysis {
  cameraClass: string;
  exampleSystems: string[];
  lens: string;
  aperture: string;
  shutterSpeed: string;
  iso: string;
  whiteBalance: string;
  focusBehavior: string;
}

export interface PhotoAnalysis {
  assetId: string;
  subjects: string[];
  peopleCount: number;
  faces: number;
  landscape: string[];
  terrain: string[];
  water: string[];
  weather: string[];
  lighting: string;
  timeOfDay: string;
  dominantColors: string[];
  negativeSpace: 'low' | 'medium' | 'high';
  focalPoint: { x: number; y: number };
  orientation: 'landscape' | 'portrait' | 'square';
  technical: {
    exposure: string;
    dynamicRange: string;
    sharpness: string;
    motionBlur: string;
    noise: string;
    whiteBalance: string;
    contrast: string;
    haze: string;
  };
  camera: CameraAnalysis;
  enhancement: EnhancementProfile;
  qaConfidence: number;
  tags: string[];
}

export interface Concept {
  id: string;
  projectId: string;
  title: string;
  hook: string;
  pillar: ContentPillar;
  targetEmotion: string;
  audience: string;
  whyOutsidersCare: string;
  educationalOpportunity: string;
  suggestedPhotoIds: string[];
  expectedEngagement: string;
  brandFitGate: { passed: boolean; reasons: string[] };
}

export interface ConceptScore {
  conceptId: string;
  brandFit: number;
  jamaicanRelevance: number;
  curiosity: number;
  relatability: number;
  usefulness: number;
  savePotential: number;
  sharePotential: number;
  commentPotential: number;
  emotionalResonance: number;
  visualEvidence: number;
  originality: number;
  factualSupport: number;
  total: number;
  rationale: string;
}

export interface Slide {
  id: string;
  order: number;
  role: 'hook' | 'setup' | 'development' | 'payoff' | 'takeaway' | 'cta';
  headline: string;
  body: string;
  assetId: string | null;
  textPosition: 'top' | 'bottom' | 'center' | 'upper-left' | 'lower-right';
  showBranding: boolean;
  pageLabel: string;
}

export interface Caption {
  hook: string;
  story: string[];
  value: string;
  question: string;
  cta: string;
  hashtags: string[];
  seoKeywords: string[];
}

export interface Carousel {
  id: string;
  projectId: string;
  conceptId: string;
  title: string;
  pillar: ContentPillar;
  slides: Slide[];
  caption: Caption;
  status: ApprovalStatus;
}

export interface Project {
  id: string;
  name: string;
  location: string;
  hikeDate: string | null;
  context: string;
  slug: string;
  status: ApprovalStatus;
  createdAt: string;
  updatedAt: string;
}

export interface StageState {
  key: string;
  label: string;
  status: 'pending' | 'running' | 'done' | 'error';
  message?: string;
}

// Pipeline stage keys (mirrors the product spec workflow).
export const PIPELINE_STAGES = [
  'upload',
  'preserve',
  'analyze',
  'enhance',
  'qa',
  'intelligence',
  'ideas',
  'scoring',
  'selection',
  'photo-select',
  'story',
  'design',
  'caption',
  'qa-final',
  'review',
] as const;

export type PipelineStage = (typeof PIPELINE_STAGES)[number];
