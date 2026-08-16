import { describe, expect, it } from 'vitest';
import { storageObjectIsExpired } from './media-retention';
import type { StorageObjectEntry } from './supabase';

function object(createdAt: string | null, id: string | null = 'object-id'): StorageObjectEntry {
  return { name: 'photo.jpg', id, created_at: createdAt, updated_at: createdAt, metadata: { size: 42 } };
}

describe('media retention', () => {
  const cutoff = new Date('2026-08-09T12:00:00.000Z');

  it('expires files created before the cutoff', () => {
    expect(storageObjectIsExpired(object('2026-08-09T11:59:59.000Z'), cutoff)).toBe(true);
  });

  it('keeps files created at or after the cutoff', () => {
    expect(storageObjectIsExpired(object('2026-08-09T12:00:00.000Z'), cutoff)).toBe(false);
    expect(storageObjectIsExpired(object('2026-08-10T12:00:00.000Z'), cutoff)).toBe(false);
  });

  it('does not treat folders or invalid timestamps as files to delete', () => {
    expect(storageObjectIsExpired(object('2026-08-01T00:00:00.000Z', null), cutoff)).toBe(false);
    expect(storageObjectIsExpired(object(null), cutoff)).toBe(false);
  });
});
