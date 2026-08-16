// Export: individual slides, ZIP package with caption/hashtags/alt/metadata/README.

import JSZip from 'jszip';
import { writeMedia } from '../lib/storage';
import type { Carousel, Project } from '../lib/types';

export interface ExportManifest {
  files: string[];
  zipPath: string;
}

function zipName(project: Project): string {
  return `lifestyle-hikers-${project.slug}-carousel.zip`;
}

export function buildMetadata(carousel: Carousel, project: Project): string {
  return JSON.stringify(
    {
      project: project.name,
      location: project.location,
      hikeDate: project.hikeDate,
      carouselTitle: carousel.title,
      pillar: carousel.pillar,
      slideCount: carousel.slides.length,
      generatedAt: new Date().toISOString(),
      brand: 'Lifestyle Hikers',
      handle: '@LifestyleHikers',
    },
    null,
    2,
  );
}

export function buildReadme(carousel: Carousel, project: Project): string {
  return [
    'Lifestyle Hikers — Carousel Export',
    '==================================',
    '',
    `Project: ${project.name}`,
    `Location: ${project.location || 'N/A'}`,
    `Date: ${project.hikeDate || 'N/A'}`,
    `Carousel: ${carousel.title}`,
    `Pillar: ${carousel.pillar}`,
    `Slides: ${carousel.slides.length}`,
    '',
    'Files:',
    '  01.jpg ... NN.jpg  — individual slides (1080×1350, 4:5)',
    '  caption.txt        — full caption with hook, story, value, question, CTA',
    '  hashtags.txt       — 5–10 hashtags (one per line)',
    '  alt-text.txt       — accessibility text per slide',
    '  metadata.json      — machine-readable project metadata',
    '  README.txt         — this file',
    '',
    'Brand: Lifestyle Hikers (@LifestyleHikers)',
    'Philosophy: One foot in front the other.',
  ].join('\n');
}

export async function buildZip(
  carousel: Carousel,
  project: Project,
  slideBuffers: Buffer[],
): Promise<Buffer> {
  const zip = new JSZip();

  slideBuffers.forEach((buf, i) => {
    const name = `${String(i + 1).padStart(2, '0')}.jpg`;
    zip.file(name, buf);
  });

  zip.file('caption.txt', formatCaption(carousel));
  zip.file('hashtags.txt', carousel.caption.hashtags.join('\n'));
  zip.file('alt-text.txt', carousel.slides.map((s, i) => `${i + 1}. ${s.headline} — ${s.body}`).join('\n'));
  zip.file('metadata.json', buildMetadata(carousel, project));
  zip.file('README.txt', buildReadme(carousel, project));

  return zip.generateAsync({ type: 'nodebuffer' });
}

export async function exportCarousel(
  carousel: Carousel,
  project: Project,
  slideBuffers: Buffer[],
): Promise<ExportManifest> {
  const zipBuffer = await buildZip(carousel, project, slideBuffers);
  const name = zipName(project);
  const outPath = await writeMedia('export', name, zipBuffer);
  return { files: [], zipPath: outPath };
}

function formatCaption(carousel: Carousel): string {
  const c = carousel.caption;
  return [
    c.hook,
    '',
    ...c.story,
    '',
    c.value,
    '',
    c.question,
    '',
    c.cta,
    '',
    '',
    c.hashtags.join(' '),
  ].join('\n');
}
