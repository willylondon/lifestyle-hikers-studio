import { getDb } from './db';
import { isSupabaseEnabled, supabaseInsert, supabasePatch } from './supabase';
import { newId, nowIso } from './ids';

export interface PublishJob {
  id: string;
  carouselId: string;
  kind: string;
  status: string;
  metaMediaId?: string | null;
  metaContainerId?: string | null;
  error?: string | null;
  createdAt: string;
}

export async function createPublishJob(carouselId: string, kind = 'instagram-carousel'): Promise<PublishJob> {
  const job: PublishJob = { id: newId('pub'), carouselId, kind, status: 'Publishing', createdAt: nowIso() };
  if (isSupabaseEnabled()) {
    await supabaseInsert('publish_jobs', {
      id: job.id, carousel_id: carouselId, kind, status: job.status,
      meta_media_id: null, meta_container_id: null, error: null, created_at: job.createdAt,
    });
  } else {
    getDb().prepare(`INSERT INTO publish_jobs (id,carousel_id,kind,status,meta_media_id,meta_container_id,error,created_at)
      VALUES (?,?,?,?,NULL,NULL,NULL,?)`).run(job.id, carouselId, kind, job.status, job.createdAt);
  }
  return job;
}

export async function updatePublishJob(id: string, patch: { status?: string; metaMediaId?: string | null; metaContainerId?: string | null; error?: string | null }): Promise<void> {
  if (isSupabaseEnabled()) {
    const body: Record<string, string | null> = {};
    if (patch.status !== undefined) body.status = patch.status;
    if (patch.metaMediaId !== undefined) body.meta_media_id = patch.metaMediaId;
    if (patch.metaContainerId !== undefined) body.meta_container_id = patch.metaContainerId;
    if (patch.error !== undefined) body.error = patch.error;
    await supabasePatch('publish_jobs', `id=eq.${encodeURIComponent(id)}`, body);
    return;
  }
  const db = getDb();
  if (patch.status !== undefined) db.prepare('UPDATE publish_jobs SET status=? WHERE id=?').run(patch.status, id);
  if (patch.metaMediaId !== undefined) db.prepare('UPDATE publish_jobs SET meta_media_id=? WHERE id=?').run(patch.metaMediaId, id);
  if (patch.metaContainerId !== undefined) db.prepare('UPDATE publish_jobs SET meta_container_id=? WHERE id=?').run(patch.metaContainerId, id);
  if (patch.error !== undefined) db.prepare('UPDATE publish_jobs SET error=? WHERE id=?').run(patch.error, id);
}
