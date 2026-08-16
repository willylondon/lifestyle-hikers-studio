'use client';

import { useEffect, useState } from 'react';

type DriveItem = {
  id: string;
  name: string;
  mimeType: string;
  thumbnailLink?: string;
  size?: string;
};

interface Props {
  selected: DriveItem[];
  onChange: (files: DriveItem[]) => void;
}

export function DrivePicker({ selected, onChange }: Props) {
  const [configured, setConfigured] = useState(false);
  const [connected, setConnected] = useState(false);
  const [items, setItems] = useState<DriveItem[]>([]);
  const [folderStack, setFolderStack] = useState<Array<{ id: string; name: string }>>([{ id: 'root', name: 'My Drive' }]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    void loadStatus();
  }, []);

  async function loadStatus() {
    try {
      const res = await fetch('/api/integrations/google/status');
      const data = await res.json();
      setConfigured(Boolean(data.configured));
      setConnected(Boolean(data.connected));
      if (data.connected) await loadFolder('root');
    } finally {
      setLoading(false);
    }
  }

  async function loadFolder(folderId: string) {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/integrations/google/files?folderId=${encodeURIComponent(folderId)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not load Google Drive.');
      setItems(data.files || []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function toggle(item: DriveItem) {
    if (selected.some((x) => x.id === item.id)) onChange(selected.filter((x) => x.id !== item.id));
    else onChange([...selected, item].slice(0, 30));
  }

  async function openFolder(item: DriveItem) {
    setFolderStack((s) => [...s, { id: item.id, name: item.name }]);
    await loadFolder(item.id);
  }

  async function goBack() {
    if (folderStack.length <= 1) return;
    const next = folderStack.slice(0, -1);
    setFolderStack(next);
    await loadFolder(next[next.length - 1].id);
  }

  if (loading && !connected) return <div className="drive-panel"><p className="small muted">Checking Google Drive…</p></div>;

  if (!configured) {
    return (
      <div className="drive-panel">
        <div>
          <strong>Google Drive</strong>
          <p className="small muted">Drive import becomes available after GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and GOOGLE_REDIRECT_URI are configured.</p>
        </div>
      </div>
    );
  }

  if (!connected) {
    return (
      <div className="drive-panel drive-connect">
        <div>
          <strong>Lifestyle Hikers Google Drive</strong>
          <p className="small muted">Connect Drive with read-only access, then select the hike photos for this campaign.</p>
        </div>
        <a className="btn btn-secondary" href="/api/integrations/google/start">Connect Google Drive</a>
      </div>
    );
  }

  return (
    <div className="drive-panel">
      <div className="drive-head">
        <div>
          <strong>Import from Google Drive</strong>
          <p className="small muted">{selected.length} selected · {folderStack.map((x) => x.name).join(' / ')}</p>
        </div>
        {folderStack.length > 1 && <button type="button" className="btn btn-secondary" onClick={goBack}>Back</button>}
      </div>
      {error && <div className="auth-error">{error}</div>}
      <div className="drive-grid">
        {items.map((item) => {
          const folder = item.mimeType === 'application/vnd.google-apps.folder';
          const media = item.mimeType.startsWith('image/') || item.mimeType.startsWith('video/');
          if (!folder && !media) return null;
          const active = selected.some((x) => x.id === item.id);
          return (
            <button
              type="button"
              key={item.id}
              className={`drive-item ${active ? 'selected' : ''}`}
              onClick={() => folder ? openFolder(item) : toggle(item)}
            >
              <div className="drive-thumb">
                {folder ? <span className="folder-icon">▰</span> : item.thumbnailLink ? <img src={item.thumbnailLink} alt="" /> : <span>MEDIA</span>}
              </div>
              <span className="drive-name">{item.name}</span>
              {!folder && <span className="drive-check">{active ? '✓' : '+'}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
