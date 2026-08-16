import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth-server';
import { listProjects } from '@/lib/repo';
import { ProjectCard } from './project-card';
import './projects.css';

export const dynamic = 'force-dynamic';

export default async function ProjectsPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  const projects = await listProjects(session.userId);

  return (
    <div>
      <div className="page-head flex-between">
        <div>
          <h1 className="page-title">Projects</h1>
          <p className="page-sub">Your Lifestyle Hikers carousel campaigns.</p>
        </div>
        <Link href="/create" className="btn btn-primary">
          + New campaign
        </Link>
      </div>

      {projects.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid grid-3">
          {projects.map((p) => (
            <ProjectCard key={p.id} project={p} />
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="card empty-state">
      <div className="brand-mark" style={{ width: 48, height: 48, marginBottom: 16 }}>
        LH
      </div>
      <h3>No campaigns yet</h3>
      <p className="muted">
        Upload a hike&apos;s photos and videos, and let the studio turn them into an Instagram-ready carousel.
      </p>
      <Link href="/create" className="btn btn-primary" style={{ marginTop: 16 }}>
        Create your first campaign
      </Link>
    </div>
  );
}
