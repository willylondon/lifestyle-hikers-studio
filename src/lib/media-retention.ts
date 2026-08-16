import {
  deleteObjects,
  isSupabaseEnabled,
  listObjects,
  supabaseDelete,
  supabasePatch,
  supabaseSelect,
  type StorageObjectEntry,
} from './supabase';

export const MEDIA_RETENTION_DAYS = 7;
export const MANAGED_MEDIA_PREFIXES = ['original', 'enhanced', 'derivative', 'export', 'incoming'] as const;

interface CleanupOptions {
  days?: number;
  dryRun?: boolean;
  now?: Date;
}

export interface MediaCleanupResult {
  dryRun: boolean;
  cutoff: string;
  deletedObjectCount: number;
  deletedBytes: number;
  affectedProjectCount: number;
}

export function storageObjectIsExpired(entry: StorageObjectEntry, cutoff: Date): boolean {
  if (!entry.id || !entry.created_at) return false;
  const createdAt = Date.parse(entry.created_at);
  return Number.isFinite(createdAt) && createdAt < cutoff.getTime();
}

export async function cleanupExpiredMedia(options: CleanupOptions = {}): Promise<MediaCleanupResult> {
  if (!isSupabaseEnabled()) throw new Error('Supabase is required for media retention cleanup.');

  const days = options.days ?? MEDIA_RETENTION_DAYS;
  const now = options.now ?? new Date();
  const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const expiredObjects: Array<{ path: string; bytes: number }> = [];

  for (const prefix of MANAGED_MEDIA_PREFIXES) {
    await collectExpiredObjects(prefix, cutoff, expiredObjects);
  }

  const oldAssets = await supabaseSelect<{ project_id: string }>(
    'media_assets',
    `select=project_id&created_at=lt.${encodeURIComponent(cutoff.toISOString())}`,
  );
  const affectedProjectIds = [...new Set(oldAssets.map((asset) => asset.project_id))];

  if (!options.dryRun) {
    for (let i = 0; i < expiredObjects.length; i += 1000) {
      await deleteObjects(expiredObjects.slice(i, i + 1000).map((object) => object.path));
    }

    const cutoffFilter = `created_at=lt.${encodeURIComponent(cutoff.toISOString())}`;
    await supabaseDelete('media_assets', cutoffFilter);
    await supabaseDelete('exports', cutoffFilter);

    for (const projectId of affectedProjectIds) {
      const remaining = await supabaseSelect<{ id: string }>(
        'media_assets',
        `select=id&project_id=eq.${encodeURIComponent(projectId)}&limit=1`,
      );
      if (remaining.length === 0) {
        await supabasePatch('projects', `id=eq.${encodeURIComponent(projectId)}`, {
          status: 'Media Expired',
          updated_at: now.toISOString(),
        });
      }
    }
  }

  return {
    dryRun: Boolean(options.dryRun),
    cutoff: cutoff.toISOString(),
    deletedObjectCount: expiredObjects.length,
    deletedBytes: expiredObjects.reduce((total, object) => total + object.bytes, 0),
    affectedProjectCount: affectedProjectIds.length,
  };
}

async function collectExpiredObjects(
  prefix: string,
  cutoff: Date,
  output: Array<{ path: string; bytes: number }>,
): Promise<void> {
  const limit = 1000;
  for (let offset = 0; ; offset += limit) {
    const entries = await listObjects(prefix, limit, offset);
    for (const entry of entries) {
      const path = `${prefix}/${entry.name}`;
      if (!entry.id) {
        await collectExpiredObjects(path, cutoff, output);
      } else if (storageObjectIsExpired(entry, cutoff)) {
        output.push({ path, bytes: Number(entry.metadata?.size ?? 0) });
      }
    }
    if (entries.length < limit) break;
  }
}
