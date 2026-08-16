import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth-server';
import { getProject, loadConcepts, loadCarousel } from '@/lib/repo';
import { listAssets } from '@/lib/media-repo';
import { ProjectWorkspace } from './workspace';

export const dynamic = 'force-dynamic';

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect('/login');
  const { id } = await params;
  const project = await getProject(id, session.userId);
  if (!project) redirect('/projects');
  const concepts = await loadConcepts(id);
  const carousel = await loadCarousel(id);
  const assets = await listAssets(id);

  return (
    <ProjectWorkspace
      project={project}
      concepts={concepts}
      carousel={carousel}
      assets={assets}
    />
  );
}
