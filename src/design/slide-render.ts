// Slide rendering: composites enhanced photography with an editorial Lifestyle Hikers
// design system into 1080×1350 (4:5). The photo remains dominant and text sits in
// image-aware zones with restrained, localized support overlays.

import sharp from 'sharp';
import type { Slide } from '../lib/types';
import { config } from '../lib/config';

const W = config.limits.slideWidth;
const H = config.limits.slideHeight;

const HEADLINE_FONT = "'Arial Black', 'Inter', 'Helvetica Neue', Arial, sans-serif";
const BODY_FONT = "'Inter', 'Helvetica Neue', Arial, sans-serif";
const ACCENT = '#D2B072';

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function wrapText(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > maxChars) {
      if (cur.trim()) lines.push(cur.trim());
      cur = w;
    } else {
      cur = (cur + ' ' + w).trim();
    }
  }
  if (cur.trim()) lines.push(cur.trim());
  return lines;
}

interface TextBlock {
  headline: string;
  body: string;
  position: Slide['textPosition'];
}

interface LayoutSpec {
  textX: number;
  textY: number;
  headlineSize: number;
  bodySize: number;
  anchor: 'start' | 'middle' | 'end';
  brandX: number;
  brandY: number;
  pageX: number;
  pageY: number;
  brandAnchor: 'start' | 'middle' | 'end';
  pageAnchor: 'start' | 'middle' | 'end';
  dividerX1: number;
  dividerX2: number;
  dividerY: number;
  textWrap: number;
  bodyWrap: number;
  scrimSvg: string;
  textBoxHeightPad: number;
}

function buildLocalizedScrim(position: Slide['textPosition']): string {
  switch (position) {
    case 'center':
      return `
        <defs>
          <linearGradient id="scrim-center" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#000000" stop-opacity="0.0"/>
            <stop offset="45%" stop-color="#000000" stop-opacity="0.14"/>
            <stop offset="100%" stop-color="#000000" stop-opacity="0.30"/>
          </linearGradient>
        </defs>
        <rect x="120" y="350" rx="32" ry="32" width="840" height="420" fill="url(#scrim-center)"/>
      `;
    case 'lower-right':
      return `
        <defs>
          <linearGradient id="scrim-right" x1="1" y1="1" x2="0" y2="0">
            <stop offset="0%" stop-color="#000000" stop-opacity="0.42"/>
            <stop offset="100%" stop-color="#000000" stop-opacity="0.0"/>
          </linearGradient>
        </defs>
        <rect x="360" y="520" width="660" height="690" fill="url(#scrim-right)"/>
      `;
    case 'top':
    case 'upper-left':
      return `
        <defs>
          <linearGradient id="scrim-left" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#000000" stop-opacity="0.50"/>
            <stop offset="55%" stop-color="#000000" stop-opacity="0.18"/>
            <stop offset="100%" stop-color="#000000" stop-opacity="0.0"/>
          </linearGradient>
        </defs>
        <rect x="0" y="0" width="820" height="700" fill="url(#scrim-left)"/>
      `;
    case 'bottom':
    default:
      return `
        <defs>
          <linearGradient id="scrim-bottom" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stop-color="#000000" stop-opacity="0.62"/>
            <stop offset="65%" stop-color="#000000" stop-opacity="0.18"/>
            <stop offset="100%" stop-color="#000000" stop-opacity="0.0"/>
          </linearGradient>
        </defs>
        <rect x="0" y="650" width="1080" height="700" fill="url(#scrim-bottom)"/>
      `;
  }
}

function layoutFor(block: TextBlock, headlineLines: string[], bodyLines: string[]): LayoutSpec {
  const headlineSize = headlineLines.length >= 3 ? 64 : headlineLines.length === 2 ? 70 : 78;
  const bodySize = 30;
  const bodyBlockHeight = bodyLines.length * bodySize * 1.35;
  const headlineBlockHeight = headlineLines.length * headlineSize * 1.06;

  switch (block.position) {
    case 'center':
      return {
        textX: W / 2,
        textY: H / 2 - (headlineBlockHeight + bodyBlockHeight) / 2 + 20,
        headlineSize,
        bodySize,
        anchor: 'middle',
        brandX: W / 2,
        brandY: 104,
        pageX: 84,
        pageY: H - 58,
        brandAnchor: 'middle',
        pageAnchor: 'start',
        dividerX1: W / 2 - 72,
        dividerX2: W / 2 + 72,
        dividerY: H / 2,
        textWrap: 20,
        bodyWrap: 34,
        scrimSvg: buildLocalizedScrim(block.position),
        textBoxHeightPad: 20,
      };
    case 'lower-right':
      return {
        textX: W - 84,
        textY: H - 330 - bodyBlockHeight,
        headlineSize,
        bodySize,
        anchor: 'end',
        brandX: 84,
        brandY: 78,
        pageX: 84,
        pageY: H - 58,
        brandAnchor: 'start',
        pageAnchor: 'start',
        dividerX1: W - 236,
        dividerX2: W - 84,
        dividerY: H - 300,
        textWrap: 18,
        bodyWrap: 30,
        scrimSvg: buildLocalizedScrim(block.position),
        textBoxHeightPad: 18,
      };
    case 'top':
    case 'upper-left':
      return {
        textX: 84,
        textY: 188,
        headlineSize,
        bodySize,
        anchor: 'start',
        brandX: 84,
        brandY: 78,
        pageX: 84,
        pageY: H - 58,
        brandAnchor: 'start',
        pageAnchor: 'start',
        dividerX1: 84,
        dividerX2: 236,
        dividerY: 312,
        textWrap: 18,
        bodyWrap: 30,
        scrimSvg: buildLocalizedScrim(block.position),
        textBoxHeightPad: 18,
      };
    case 'bottom':
    default:
      return {
        textX: 84,
        textY: H - 330 - bodyBlockHeight,
        headlineSize,
        bodySize,
        anchor: 'start',
        brandX: 84,
        brandY: 78,
        pageX: 84,
        pageY: H - 58,
        brandAnchor: 'start',
        pageAnchor: 'start',
        dividerX1: 84,
        dividerX2: 236,
        dividerY: H - 300,
        textWrap: 18,
        bodyWrap: 30,
        scrimSvg: buildLocalizedScrim(block.position),
        textBoxHeightPad: 18,
      };
  }
}

function buildOverlaySvg(block: TextBlock, pageLabel: string, showBranding: boolean): Buffer {
  const rawHeadlineLines = wrapText(block.headline.toUpperCase(), 20).slice(0, 3);
  const rawBodyLines = wrapText(block.body, 34).slice(0, 4);
  const layout = layoutFor(block, rawHeadlineLines, rawBodyLines);

  const headlineLines = wrapText(block.headline.toUpperCase(), layout.textWrap).slice(0, 3);
  const bodyLines = wrapText(block.body, layout.bodyWrap).slice(0, 4);
  const headlineSize = layout.headlineSize;
  const bodySize = layout.bodySize;

  let y = layout.textY;
  let headlineSpans = '';
  headlineLines.forEach((line) => {
    headlineSpans += `<tspan x="${layout.textX}" y="${y}" text-anchor="${layout.anchor}">${esc(line)}</tspan>`;
    y += headlineSize * 1.05;
  });

  const dividerY = y + 8;
  y += 40;

  let bodySpans = '';
  bodyLines.forEach((line) => {
    bodySpans += `<tspan x="${layout.textX}" y="${y}" text-anchor="${layout.anchor}">${esc(line)}</tspan>`;
    y += bodySize * 1.35;
  });

  const brandLabel = `<text x="${layout.brandX}" y="${layout.brandY}" text-anchor="${layout.brandAnchor}" font-family="${BODY_FONT}" font-size="22" font-weight="600" letter-spacing="7" fill="#ffffff" opacity="0.92">LIFESTYLE HIKERS</text>`;
  const pageSvg = `<text x="${layout.pageX}" y="${layout.pageY}" text-anchor="${layout.pageAnchor}" font-family="${BODY_FONT}" font-size="22" font-weight="500" fill="#ffffff" opacity="0.66">${esc(pageLabel)}</text>`;
  const handleSvg = showBranding
    ? `<text x="${W - 84}" y="${H - 58}" text-anchor="end" font-family="${BODY_FONT}" font-size="24" font-weight="600" fill="${ACCENT}" opacity="0.95">@LifestyleHikers</text>`
    : '';

  const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    ${layout.scrimSvg}
    ${brandLabel}
    <text x="${layout.textX}" y="0" font-family="${HEADLINE_FONT}" font-size="${headlineSize}" font-weight="900" fill="#ffffff" letter-spacing="-1.4">${headlineSpans}</text>
    <line x1="${layout.dividerX1}" y1="${dividerY}" x2="${layout.dividerX2}" y2="${dividerY}" stroke="${ACCENT}" stroke-width="4" stroke-linecap="round" opacity="0.9"/>
    <text x="${layout.textX}" y="0" font-family="${BODY_FONT}" font-size="${bodySize}" font-weight="450" fill="#ffffff" opacity="0.94">${bodySpans}</text>
    ${pageSvg}
    ${handleSvg}
  </svg>`;

  return Buffer.from(svg);
}

/**
 * Renders a single slide: enhanced photo (cover-fit to 4:5) + Lifestyle Hikers
 * editorial overlay.
 */
export async function renderSlide(
  enhancedPhoto: Buffer,
  slide: Slide,
): Promise<Buffer> {
  const position = slide.role === 'cta' ? 'center' : slide.role === 'hook' || slide.role === 'payoff' ? 'upper-left' : slide.textPosition;

  const base = await sharp(enhancedPhoto)
    .resize(W, H, { fit: 'cover', position: 'attention' })
    .jpeg({ quality: 92, mozjpeg: true })
    .toBuffer();

  const overlay = buildOverlaySvg(
    { headline: slide.headline, body: slide.body, position },
    slide.pageLabel,
    slide.showBranding,
  );

  return sharp(base)
    .composite([{ input: overlay, top: 0, left: 0 }])
    .jpeg({ quality: 92, mozjpeg: true })
    .toBuffer();
}

/**
 * Renders a stronger branded closing tile while staying consistent with the
 * editorial system.
 */
export async function renderBrandTile(photo: Buffer | null, headline: string): Promise<Buffer> {
  const base = photo
    ? await sharp(photo).resize(W, H, { fit: 'cover', position: 'attention' }).jpeg().toBuffer()
    : await sharp({ create: { width: W, height: H, channels: 3, background: { r: 15, g: 28, b: 22 } } }).jpeg().toBuffer();

  const svg = Buffer.from(`<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="cta" x1="0" y1="1" x2="0" y2="0">
        <stop offset="0%" stop-color="#000000" stop-opacity="0.74"/>
        <stop offset="100%" stop-color="#000000" stop-opacity="0.12"/>
      </linearGradient>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#cta)"/>
    <text x="${W / 2}" y="110" text-anchor="middle" font-family="${BODY_FONT}" font-size="24" font-weight="600" letter-spacing="8" fill="#ffffff" opacity="0.94">LIFESTYLE HIKERS</text>
    <text x="${W / 2}" y="${H / 2 - 40}" text-anchor="middle" font-family="${HEADLINE_FONT}" font-size="92" font-weight="900" fill="#ffffff" letter-spacing="-1.4">${esc(headline.toUpperCase())}</text>
    <line x1="${W / 2 - 90}" y1="${H / 2 + 14}" x2="${W / 2 + 90}" y2="${H / 2 + 14}" stroke="${ACCENT}" stroke-width="4" stroke-linecap="round" opacity="0.95"/>
    <text x="${W / 2}" y="${H / 2 + 96}" text-anchor="middle" font-family="${BODY_FONT}" font-size="34" font-weight="500" fill="#ffffff" opacity="0.96">One foot in front the other.</text>
    <text x="${W / 2}" y="${H / 2 + 152}" text-anchor="middle" font-family="${BODY_FONT}" font-size="28" font-weight="600" fill="${ACCENT}">@LifestyleHikers</text>
  </svg>`);

  return sharp(base).composite([{ input: svg }]).jpeg({ quality: 92, mozjpeg: true }).toBuffer();
}
