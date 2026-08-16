import Link from 'next/link';
import type { Project } from '@/lib/types';

const STATUS_BADGE: Record<string, string> = {
  Draft: 'badge',
  'AI Processing': 'badge badge-warn',
  'Processing Media': 'badge badge-warn',
  'Needs Review': 'badge badge-accent',
  Approved: 'badge badge-accent',
  Scheduled: 'badge',
  Publishing: 'badge badge-warn',
  Published: 'badge badge-accent',
  'Media Expired': 'badge',
  Failed: 'badge badge-warn',
};

function displayStatus(status: string): string {
  return status === 'AI Processing' ? 'Processing Media' : status;
}

export function ProjectCard({ project }: { project: Project }) {
  return (
    <Link href={`/projects/${project.id}`} className="project-card card">
      <div className="project-card-top">
        <span className={STATUS_BADGE[project.status] ?? 'badge'}>{displayStatus(project.status)}</span>
        <span className="faint small">{project.hikeDate ?? ''}</span>
      </div>
      <h3 className="project-card-name">{project.name}</h3>
      {project.location && <p className="muted small project-loc">📍 {project.location}</p>}
      <div className="project-card-foot faint small">
        {new Date(project.updatedAt).toLocaleDateString()}
      </div>
    </Link>
  );
}
