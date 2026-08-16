import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth-server';
import { getProject, loadConcepts, loadCarousel } from '@/lib/repo';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    const { id } = await params;
    const project = await getProject(id, session.userId);
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }
    const concepts = await loadConcepts(id);
    const carousel = await loadCarousel(id);
    return NextResponse.json({ project, concepts, carousel });
  } catch (e) {
    if ((e as Error).message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
