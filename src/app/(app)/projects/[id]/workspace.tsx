'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Carousel, Concept, MediaAsset, Project } from '@/lib/types';
import './workspace.css';

const TABS = ['Media', 'Enhance', 'Ideas', 'Carousel', 'Caption', 'Review'] as const;
type Tab = (typeof TABS)[number];

interface Props {
  project: Project;
  concepts: Concept[];
  carousel: Carousel | null;
  assets: MediaAsset[];
}

export function ProjectWorkspace({ project, concepts, carousel, assets }: Props) {
  const [tab, setTab] = useState<Tab>('Media');
  const [currentCarousel, setCurrentCarousel] = useState<Carousel | null>(carousel);
  const assetById = useMemo(() => new Map(assets.map((asset) => [asset.id, asset])), [assets]);

  return (
    <div className="workspace">
      <div className="ws-head">
        <div>
          <div className="ws-breadcrumb faint small">
            <a href="/projects">Projects</a> / {project.name}
          </div>
          <h1 className="page-title">{project.name}</h1>
          {project.location && <p className="page-sub">📍 {project.location}</p>}
        </div>
        <span className="badge badge-accent">{displayProjectStatus(project.status)}</span>
      </div>

      <div className="ws-tabs">
        {TABS.map((t) => (
          <button key={t} className={`ws-tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>

      <div className="ws-body">
        {project.status === 'Media Expired' && (
          <div className="card" style={{ marginBottom: 16 }}>
            <strong>Photos expired</strong>
            <p className="muted small" style={{ marginTop: 6 }}>
              The Supabase photo files were automatically deleted after seven days. Project details and captions are still saved.
            </p>
          </div>
        )}
        {tab === 'Media' && <MediaPanel assets={assets} projectId={project.id} expired={project.status === 'Media Expired'} />}
        {tab === 'Enhance' && <EnhancePanel assets={assets} />}
        {tab === 'Ideas' && <IdeasPanel concepts={concepts} projectId={project.id} onSwitch={setCurrentCarousel} current={currentCarousel} />}
        {tab === 'Carousel' && <CarouselPanel carousel={currentCarousel} projectId={project.id} assetById={assetById} onUpdate={setCurrentCarousel} />}
        {tab === 'Caption' && <CaptionPanel carousel={currentCarousel} projectId={project.id} onUpdate={setCurrentCarousel} />}
        {tab === 'Review' && <ReviewPanel carousel={currentCarousel} projectId={project.id} onUpdate={setCurrentCarousel} />}
      </div>
    </div>
  );
}

function displayProjectStatus(status: string): string {
  return status === 'AI Processing' ? 'Processing Media' : status;
}

function MediaPanel({ assets, projectId, expired }: { assets: MediaAsset[]; projectId: string; expired: boolean }) {
  return (
    <div>
      <h3 className="panel-title">Media library</h3>
      <p className="muted small">Originals, enhanced photos, derivatives and exports are retained in Supabase for seven days.</p>
      {assets.length === 0 ? (
        <div className="card empty-state">
          <p className="muted">{expired ? 'These photos have reached the seven-day retention limit and were deleted.' : 'No media yet. Upload files to begin.'}</p>
        </div>
      ) : (
        <div className="media-grid">
          {assets.map((a) => (
            <div key={a.id} className="media-item">
              {a.kind === 'image' ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`/api/media/enhanced/${a.sourceId}.jpg`} alt={a.filename} onError={(e) => { (e.target as HTMLImageElement).src = `/api/media/original/${a.sourceId}.jpg`; }} />
              ) : (
                <div className="media-video-placeholder">🎬 {a.filename}</div>
              )}
              <div className="media-meta">
                <span className="pill">{a.sourceId}</span>
                <span className="faint small">{a.orientation}</span>
              </div>
            </div>
          ))}
        </div>
      )}
      <a className="btn" href={`/projects/${projectId}`} style={{ marginTop: 16 }}>
        ↻ Refresh
      </a>
    </div>
  );
}

function EnhancePanel({ assets }: { assets: MediaAsset[] }) {
  const images = assets.filter((a) => a.kind === 'image');
  return (
    <div>
      <h3 className="panel-title">Before / After</h3>
      <p className="muted small">Compare Original vs Enhanced Master. Enhancement is non-destructive — originals are never overwritten.</p>
      <div className="ba-grid">
        {images.map((a) => (
          <div key={a.id} className="ba-item card">
            <div className="ba-pair">
              <div>
                <div className="ba-label">Original</div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={originalPreviewSrc(a)} alt={`${a.sourceId} original`} />
              </div>
              <div>
                <div className="ba-label">Enhanced</div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/media/enhanced/${a.sourceId}.jpg`} alt={`${a.sourceId} enhanced`} />
              </div>
            </div>
            <div className="pill">{a.sourceId}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function originalPreviewSrc(asset: MediaAsset): string {
  if (/image\/(?:heic|heif)/.test(asset.mimeType) || /\.(?:heic|heif)$/i.test(asset.filename)) {
    return `/api/media/derivative/${asset.sourceId}-source-preview.jpg`;
  }
  const extension = asset.filename.match(/\.[a-z0-9]+$/i)?.[0]?.toLowerCase() ?? '.jpg';
  return `/api/media/original/${asset.sourceId}${extension}`;
}

function IdeasPanel({ concepts, projectId, onSwitch, current }: { concepts: Concept[]; projectId: string; onSwitch: (c: Carousel | null) => void; current: Carousel | null }) {
  const [switching, setSwitching] = useState('');
  if (concepts.length === 0) {
    return <div className="card empty-state"><p className="muted">No concepts yet. Run analysis on your media.</p></div>;
  }
  async function switchConcept(id: string) {
    setSwitching(id);
    const res = await fetch(`/api/projects/${projectId}/carousel`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'switch-concept', conceptId: id }),
    });
    const data = await res.json();
    if (res.ok) onSwitch(data.carousel);
    setSwitching('');
  }
  return (
    <div>
      <h3 className="panel-title">Content concepts</h3>
      <p className="muted small">Each concept was generated and scored for brand fit, relatability, and engagement.</p>
      <div className="concept-grid">
        {concepts.map((c) => {
          const active = current?.conceptId === c.id;
          return (
            <div key={c.id} className={`concept-card card ${active ? 'active' : ''}`}>
              <div className="concept-pillars">
                <span className="pill">{c.pillar}</span>
                {active && <span className="badge badge-accent">Selected</span>}
              </div>
              <h4 className="concept-title">{c.title}</h4>
              <p className="concept-hook muted">{c.hook}</p>
              <p className="small faint">{c.whyOutsidersCare}</p>
              <div className="concept-meta small muted">
                <span>Emotion: {c.targetEmotion}</span>
                <span>Engagement: {c.expectedEngagement}</span>
              </div>
              <button className="btn" disabled={switching === c.id || active} onClick={() => switchConcept(c.id)}>
                {switching === c.id ? 'Switching…' : active ? 'Current' : 'Use this concept'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CarouselPanel({ carousel, projectId, assetById, onUpdate }: { carousel: Carousel | null; projectId: string; assetById: Map<string, MediaAsset>; onUpdate: (c: Carousel | null) => void }) {
  const [regenerating, setRegenerating] = useState(false);
  const [regenerateError, setRegenerateError] = useState('');
  if (!carousel) return <div className="card empty-state"><p className="muted">No carousel yet.</p></div>;
  const c = carousel;

  async function regenerateFromPhotos() {
    setRegenerating(true);
    setRegenerateError('');
    try {
      const res = await fetch(`/api/projects/${projectId}/carousel`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'regenerate-grounded' }),
      });
      const data = await res.json();
      if (!res.ok) {
        setRegenerateError(data.error || 'Could not regenerate from the photos.');
        return;
      }
      onUpdate(data.carousel);
    } catch {
      setRegenerateError('Network error while regenerating the carousel.');
    } finally {
      setRegenerating(false);
    }
  }

  async function saveSlides(slides: typeof c.slides) {
    const res = await fetch(`/api/projects/${projectId}/carousel`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'edit-slides', slides }),
    });
    const data = await res.json();
    if (res.ok) onUpdate(data.carousel);
  }

  function updateSlide(id: string, patch: Partial<(typeof c.slides)[number]>) {
    const slides = c.slides.map((s) => (s.id === id ? { ...s, ...patch } : s));
    onUpdate({ ...c, slides });
  }

  function reorder(from: number, dir: -1 | 1) {
    const slides = [...c.slides];
    const to = from + dir;
    if (to < 0 || to >= slides.length) return;
    [slides[from], slides[to]] = [slides[to], slides[from]];
    slides.forEach((s, i) => (s.order = i + 1));
    onUpdate({ ...c, slides });
  }

  return (
    <div>
      <div className="flex-between">
        <div>
          <h3 className="panel-title">{c.title}</h3>
          <p className="muted small">{c.slides.length} slides · {c.pillar}</p>
        </div>
        <div className="review-actions">
          <button className="btn" onClick={regenerateFromPhotos} disabled={regenerating}>
            {regenerating ? 'Matching photos & copy…' : 'Regenerate from photos'}
          </button>
          <button className="btn btn-primary" onClick={() => saveSlides(c.slides)}>Save slides</button>
        </div>
      </div>
      {regenerateError && <div className="auth-error" style={{ marginTop: 12 }}>{regenerateError}</div>}
      <div className="slide-list">
        {c.slides.map((s, i) => (
          <div key={s.id} className="slide-row card">
            <div className="slide-thumb">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={s.assetId ? `/api/media/enhanced/${assetById.get(s.assetId)?.sourceId}.jpg` : ''} alt="" onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0.2'; }} />
              <span className="slide-num">{s.order}</span>
            </div>
            <div className="slide-fields">
              <div className="small faint">{s.role} · {s.pageLabel}</div>
              <input className="input" value={s.headline} onChange={(e) => updateSlide(s.id, { headline: e.target.value })} />
              <textarea className="textarea" value={s.body} onChange={(e) => updateSlide(s.id, { body: e.target.value })} rows={2} />
              <div className="slide-controls">
                <select className="select" value={s.textPosition} onChange={(e) => updateSlide(s.id, { textPosition: e.target.value as typeof s.textPosition })}>
                  <option value="top">Text top</option>
                  <option value="center">Text center</option>
                  <option value="bottom">Text bottom</option>
                  <option value="upper-left">Upper left</option>
                  <option value="lower-right">Lower right</option>
                </select>
                <label className="checkbox small">
                  <input type="checkbox" checked={s.showBranding} onChange={(e) => updateSlide(s.id, { showBranding: e.target.checked })} /> @LifestyleHikers
                </label>
                <button className="btn btn-ghost small" onClick={() => reorder(i, -1)}>↑</button>
                <button className="btn btn-ghost small" onClick={() => reorder(i, 1)}>↓</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CaptionPanel({ carousel, projectId, onUpdate }: { carousel: Carousel | null; projectId: string; onUpdate: (c: Carousel | null) => void }) {
  if (!carousel) return <div className="card empty-state"><p className="muted">No carousel yet.</p></div>;
  const c = carousel.caption;
  async function regenerate() {
    const res = await fetch(`/api/projects/${projectId}/carousel`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'regenerate-caption' }),
    });
    const data = await res.json();
    if (res.ok) onUpdate(data.carousel);
  }
  return (
    <div>
      <div className="flex-between">
        <h3 className="panel-title">Caption, hashtags &amp; SEO</h3>
        <button className="btn" onClick={regenerate}>Regenerate caption</button>
      </div>
      <div className="caption-block card">
        <div className="cap-hook">{c.hook}</div>
        {c.story.map((p, i) => <p key={i}>{p}</p>)}
        <p className="muted">{c.value}</p>
        <p className="cap-question">{c.question}</p>
        <p className="cap-cta">{c.cta}</p>
        <div className="cap-hashtags">{c.hashtags.join(' ')}</div>
      </div>
      <div className="card" style={{ marginTop: 16 }}>
        <h4 className="small muted" style={{ marginBottom: 8 }}>SEO keywords</h4>
        <div className="cap-hashtags muted">{c.seoKeywords.join(' · ')}</div>
      </div>
    </div>
  );
}

function ReviewPanel({ carousel, projectId, onUpdate }: { carousel: Carousel | null; projectId: string; onUpdate: (c: Carousel | null) => void }) {
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const [igStatus, setIgStatus] = useState<{ configured: boolean; connected: boolean; username?: string } | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [publishMessage, setPublishMessage] = useState('');
  const [publishError, setPublishError] = useState('');

  async function refreshInstagramStatus() {
    const res = await fetch('/api/integrations/instagram/status', { cache: 'no-store' });
    setIgStatus(await res.json());
  }

  useEffect(() => { void refreshInstagramStatus(); }, []);
  if (!carousel) return <div className="card empty-state"><p className="muted">No carousel yet.</p></div>;
  const current = carousel;

  async function approve() {
    const res = await fetch(`/api/projects/${projectId}/carousel`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'approve' }),
    });
    const data = await res.json();
    if (res.ok) onUpdate(data.carousel);
  }

  async function doExport() {
    setExporting(true);
    setExportError('');
    try {
      const res = await fetch(`/api/projects/${projectId}/export`, { method: 'POST' });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setExportError(data?.error || 'Export failed.');
        return;
      }
      const contentType = res.headers.get('content-type') ?? '';
      if (contentType.includes('application/json')) {
        const data = await res.json() as { downloadUrl?: string };
        if (!data.downloadUrl) {
          setExportError('The download link could not be created.');
          return;
        }
        window.location.assign(data.downloadUrl);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `lifestyle-hikers-${projectId.slice(0, 6)}-carousel.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setExportError('Network error during export.');
    } finally {
      setExporting(false);
    }
  }

  async function publishInstagram() {
    setPublishing(true);
    setPublishError('');
    setPublishMessage('');
    onUpdate({ ...current, status: 'Publishing' });
    try {
      const res = await fetch(`/api/projects/${projectId}/publish/instagram`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        if (data?.status === 'Failed' || data?.status === 'Published') {
          onUpdate({ ...current, status: data.status });
        } else {
          onUpdate(current);
        }
        setPublishError(data?.error || 'Instagram publishing failed.');
        return;
      }
      setPublishMessage(`Published successfully to @${data.username || 'Instagram'}.`);
      onUpdate({ ...current, status: 'Published' });
    } catch {
      setPublishError('The publish result could not be confirmed. Refresh this page before attempting to publish again.');
    } finally {
      setPublishing(false);
    }
  }

  const approved = carousel.status === 'Approved';
  const published = carousel.status === 'Published';

  return (
    <div>
      <h3 className="panel-title">Review, approve &amp; publish</h3>
      <div className="card review-card">
        <div className="flex-between">
          <div>
            <h4>{carousel.title}</h4>
            <p className="muted small">{carousel.slides.length} slides · {carousel.pillar}</p>
          </div>
          <span className="badge badge-accent">{carousel.status}</span>
        </div>

        <div className="review-actions">
          {!approved && !published && (
            <button className="btn btn-primary" onClick={approve}>Approve carousel</button>
          )}

          {approved && igStatus?.connected && (
            <button className="btn btn-primary" onClick={publishInstagram} disabled={publishing}>
              {publishing ? 'Publishing to Instagram…' : `Publish to @${igStatus.username || 'Instagram'}`}
            </button>
          )}

          {approved && igStatus && !igStatus.connected && (
            <a className="btn btn-primary" href="/settings">Connect Instagram to publish</a>
          )}

          {published && <span className="badge badge-accent">Live on Instagram ✓</span>}

          <button className="btn" onClick={doExport} disabled={exporting}>
            {exporting ? 'Preparing ZIP…' : 'Download ZIP'}
          </button>
        </div>

        {publishMessage && <div className="badge badge-accent" style={{ marginTop: 14 }}>{publishMessage}</div>}
        {publishError && <div className="auth-error" style={{ marginTop: 14 }}>{publishError}</div>}
        {exportError && <div className="auth-error" style={{ marginTop: 14 }}>{exportError}</div>}

        <p className="faint small" style={{ marginTop: 12 }}>
          Nothing is sent to Instagram until the carousel is explicitly approved. Direct publishing uses the connected Instagram Professional account; ZIP export remains available at any time.
        </p>
      </div>
    </div>
  );
}
