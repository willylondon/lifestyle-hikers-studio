import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth-server';
import { listProjects } from '@/lib/repo';
import { listAssets } from '@/lib/media-repo';
import { LibraryGrid } from './library-grid';

export const dynamic = 'force-dynamic';

export default async function LibraryPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  const projects = await listProjects(session.userId);
  const assetGroups = await Promise.all(projects.map((p) => listAssets(p.id)));
  const assets = assetGroups.flat();
  return (
    <div>
      <div className="page-head">
        <h1 className="page-title">Library</h1>
        <p className="page-sub">Every source image and video, preserved immutably.</p>
      </div>
      <LibraryGrid assets={assets} />
    </div>
  );
}
