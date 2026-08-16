import type { MediaAsset } from '@/lib/types';

export function LibraryGrid({ assets }: { assets: MediaAsset[] }) {
  if (assets.length === 0) {
    return <div className="card empty-state"><p className="muted">Your library is empty. Create a campaign to add media.</p></div>;
  }
  return (
    <div className="media-grid">
      {assets.map((a) => (
        <div key={a.id} className="media-item">
          {a.kind === 'image' ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`/api/media/original/${a.sourceId}.jpg`} alt={a.filename} onError={(e) => { (e.target as HTMLImageElement).src = `/api/media/original/${a.sourceId}.png`; }} />
          ) : (
            <div className="media-video-placeholder">🎬 {a.filename}</div>
          )}
          <div className="media-meta">
            <span className="pill">{a.sourceId}</span>
            <span className="faint small">{a.kind}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
