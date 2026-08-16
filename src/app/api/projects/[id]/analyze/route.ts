import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth-server';
import { getProject, updateProjectStatus } from '@/lib/repo';
import { config } from '@/lib/config';
import { runPipeline, type UploadedFile } from '@/pipeline/orchestrator';
import { downloadDriveFile } from '@/lib/google-drive';
import { normalizeUploadMime } from '@/lib/image-normalization';
import { deleteObjects, downloadObject } from '@/lib/supabase';
import { z } from 'zod';

export const runtime = 'nodejs';
export const maxDuration = 300;

const ALLOWED_IMAGE = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
const ALLOWED_VIDEO = ['video/mp4', 'video/quicktime'];

const directUploadSchema = z.object({
  uploads: z.array(z.object({
    filename: z.string().min(1).max(180),
    mimeType: z.string().min(1).max(100),
    size: z.number().int().positive(),
    path: z.string().min(1).max(500),
  })).max(config.limits.maxFileCount).default([]),
  driveFileIds: z.array(z.string().min(1)).max(config.limits.maxFileCount).default([]),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const pendingCleanup: string[] = [];
  let activeJob: { projectId: string; userId: string } | null = null;
  try {
    const session = await requireSession();
    const { id } = await params;
    const project = await getProject(id, session.userId);
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const files: UploadedFile[] = [];
    let totalBytes = 0;
    let driveFileIds: string[] = [];
    const contentType = req.headers.get('content-type') ?? '';

    if (contentType.includes('application/json')) {
      const parsed = directUploadSchema.safeParse(await req.json());
      if (!parsed.success) {
        return NextResponse.json({ error: 'Invalid uploaded media details.' }, { status: 400 });
      }
      driveFileIds = parsed.data.driveFileIds;
      const requiredPrefix = `incoming/${session.userId}/${id}/`;
      for (const upload of parsed.data.uploads) {
        if (!upload.path.startsWith(requiredPrefix)) {
          return NextResponse.json({ error: 'Invalid upload path.' }, { status: 403 });
        }
        const mime = normalizeUploadMime(upload.filename, upload.mimeType);
        const isAllowed = ALLOWED_IMAGE.includes(mime) || ALLOWED_VIDEO.includes(mime);
        if (!isAllowed || upload.size > config.limits.maxUploadBytes) {
          return NextResponse.json({ error: `Unsupported or oversized file: ${upload.filename}` }, { status: 400 });
        }
        pendingCleanup.push(upload.path);
        const buffer = await downloadObject(upload.path);
        totalBytes += buffer.length;
        if (buffer.length !== upload.size || totalBytes > config.limits.maxUploadBytes * config.limits.maxFileCount) {
          return NextResponse.json({ error: 'Uploaded media size validation failed.' }, { status: 400 });
        }
        files.push({ filename: upload.filename, mimeType: mime, buffer });
      }
    } else {
      const form = await req.formData();
      const driveIdsRaw = form.get('driveFileIds');
      driveFileIds = typeof driveIdsRaw === 'string' && driveIdsRaw.trim()
        ? JSON.parse(driveIdsRaw) as string[]
        : [];

      const entries = form.getAll('files');
      for (const entry of entries) {
        if (!(entry instanceof File)) continue;
        const mime = normalizeUploadMime(entry.name, entry.type);
        const isAllowed = ALLOWED_IMAGE.includes(mime) || ALLOWED_VIDEO.includes(mime);
        if (!isAllowed) {
          return NextResponse.json({ error: `Unsupported file type: ${mime}` }, { status: 400 });
        }
        totalBytes += entry.size;
        if (totalBytes > config.limits.maxUploadBytes * config.limits.maxFileCount) {
          return NextResponse.json({ error: 'Total upload size exceeds limit.' }, { status: 413 });
        }
        const buffer = Buffer.from(await entry.arrayBuffer());
        files.push({ filename: entry.name, mimeType: mime, buffer });
      }
    }

    for (const driveFileId of driveFileIds.slice(0, config.limits.maxFileCount)) {
      const driveFile = await downloadDriveFile(session.userId, driveFileId);
      const mime = driveFile.mimeType.toLowerCase();
      const isAllowed = ALLOWED_IMAGE.includes(mime) || ALLOWED_VIDEO.includes(mime);
      if (!isAllowed) continue;
      totalBytes += driveFile.buffer.length;
      if (totalBytes > config.limits.maxUploadBytes * config.limits.maxFileCount) {
        return NextResponse.json({ error: 'Total upload size exceeds limit.' }, { status: 413 });
      }
      files.push(driveFile);
    }

    if (files.length === 0) {
      return NextResponse.json({ error: 'No files selected.' }, { status: 400 });
    }

    await updateProjectStatus(id, session.userId, 'Processing Media');
    activeJob = { projectId: id, userId: session.userId };

    const result = await runPipeline(project, files, {
      onStage: (stage, status, message) => {
        // Stage progress is tracked in-memory; for long jobs this would persist to DB.
        void stage;
        void status;
        void message;
      },
    });

    await updateProjectStatus(id, session.userId, 'Needs Review');
    activeJob = null;

    return NextResponse.json({
      project: result.project,
      assets: result.assets,
      analyses: result.analyses,
      concepts: result.concepts,
      scores: result.scores,
      selectedConcept: result.selectedConcept,
      carousel: result.carousel,
      stages: result.stages,
      safetyFlags: result.safetyFlags,
      factChecks: result.factChecks,
    });
  } catch (e) {
    if (activeJob) {
      await updateProjectStatus(activeJob.projectId, activeJob.userId, 'Failed').catch(() => undefined);
    }
    if ((e as Error).message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  } finally {
    if (pendingCleanup.length > 0) {
      await deleteObjects(pendingCleanup).catch(() => undefined);
    }
  }
}
