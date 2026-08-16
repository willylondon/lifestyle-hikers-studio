import { createHash, randomUUID } from 'node:crypto';

/**
 * Generates a permanent unique source media ID.
 * Format: LH-YYYY-SLUG-NNN
 * e.g. LH-2026-HEINEKEN-001
 */
export function generateSourceId(projectSlug: string, seq: number): string {
  const year = new Date().getFullYear();
  const normalized = projectSlug
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'HIKE';
  // Long project names used to lose generateProjectSlug's random suffix when
  // truncated, causing retries/projects with the same name to collide. Keep a
  // readable prefix and append a stable fingerprint of the complete slug.
  const base = normalized.length <= 24
    ? normalized
    : `${normalized.slice(0, 17).replace(/-+$/g, '')}-${createHash('sha256').update(normalized).digest('hex').slice(0, 6).toUpperCase()}`;
  const pad = String(seq).padStart(3, '0');
  return `LH-${year}-${base}-${pad}`;
}

export function generateProjectSlug(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return `${base || 'hike'}-${randomUUID().slice(0, 6)}`;
}

export function newId(prefix: string): string {
  return `${prefix}_${randomUUID().replace(/-/g, '')}`;
}

export function sha256(input: string | Buffer): string {
  return createHash('sha256').update(input).digest('hex');
}

export function nowIso(): string {
  return new Date().toISOString();
}
