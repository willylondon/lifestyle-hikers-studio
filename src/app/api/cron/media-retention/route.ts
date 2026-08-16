import { NextResponse } from 'next/server';
import { cleanupExpiredMedia, MEDIA_RETENTION_DAYS } from '@/lib/media-retention';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const dryRun = new URL(request.url).searchParams.get('dryRun') === '1';
    const result = await cleanupExpiredMedia({ days: MEDIA_RETENTION_DAYS, dryRun });
    return NextResponse.json({ ok: true, retentionDays: MEDIA_RETENTION_DAYS, ...result });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
