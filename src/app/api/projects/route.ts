import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth-server';
import { listProjects, createProject } from '@/lib/repo';
import { projectSchema } from '@/lib/validation';

export async function GET() {
  try {
    const session = await requireSession();
    const projects = await listProjects(session.userId);
    return NextResponse.json({ projects });
  } catch (e) {
    if ((e as Error).message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireSession();
    const body = await req.json();
    const parsed = projectSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
    }
    const project = await createProject({
      userId: session.userId,
      name: parsed.data.name,
      location: parsed.data.location,
      hikeDate: parsed.data.hikeDate ?? null,
      context: parsed.data.context,
    });
    return NextResponse.json({ project }, { status: 201 });
  } catch (e) {
    if ((e as Error).message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
