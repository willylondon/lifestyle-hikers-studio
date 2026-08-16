'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import './create.css';
import { DrivePicker } from './drive-picker';

const ACCEPTED = '.jpg,.jpeg,.png,.webp,.heic,.mp4,.mov';

interface DirectUpload {
  filename: string;
  mimeType: string;
  size: number;
  path: string;
  signedUrl: string;
}

export function CreateForm() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [hikeDate, setHikeDate] = useState('');
  const [context, setContext] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [driveFiles, setDriveFiles] = useState<Array<{ id: string; name: string; mimeType: string; thumbnailLink?: string; size?: string }>>([]);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [stage, setStage] = useState('');

  const addFiles = useCallback((list: FileList | null) => {
    if (!list) return;
    setFiles((prev) => [...prev, ...Array.from(list)].slice(0, 30));
  }, []);

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    addFiles(e.dataTransfer.files);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    setStage('Creating project…');
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, location, hikeDate: hikeDate || null, context }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to create project.');
        setLoading(false);
        return;
      }

      const projectId = data.project.id;

      if (files.length > 0 || driveFiles.length > 0) {
        let uploads: DirectUpload[] = [];
        if (files.length > 0) {
          setStage('Preparing secure photo uploads…');
          const signRes = await fetch(`/api/projects/${projectId}/uploads/sign`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              files: files.map((file) => ({ filename: file.name, mimeType: file.type, size: file.size })),
            }),
          });
          const signData = await signRes.json();
          if (!signRes.ok) {
            setError(signData.error || 'Could not prepare photo uploads.');
            setLoading(false);
            return;
          }
          uploads = signData.uploads as DirectUpload[];
          for (let index = 0; index < uploads.length; index++) {
            setStage(`Uploading photo ${index + 1} of ${uploads.length}…`);
            const uploadRes = await fetch(uploads[index].signedUrl, {
              method: 'PUT',
              headers: { 'Content-Type': uploads[index].mimeType },
              body: files[index],
            });
            if (!uploadRes.ok) {
              setError(`Upload failed for ${uploads[index].filename}.`);
              setLoading(false);
              return;
            }
          }
        }

        setStage('Analyzing media…');
        const analyzeRes = await fetch(`/api/projects/${projectId}/analyze`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            uploads: uploads.map(({ signedUrl: _signedUrl, ...upload }) => upload),
            driveFileIds: driveFiles.map((file) => file.id),
          }),
        });
        const analyzeData = await analyzeRes.json();
        if (!analyzeRes.ok) {
          setError(analyzeData.error || 'Analysis failed.');
          setLoading(false);
          return;
        }
      }

      router.push(`/projects/${projectId}`);
      router.refresh();
    } catch {
      setError('Network error.');
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="create-form card">
      <div className="grid grid-2">
        <div className="field">
          <label>Hike / project name *</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Heineken River Hike" required />
        </div>
        <div className="field">
          <label>Location (parish / area)</label>
          <input className="input" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="St Thomas, Jamaica" />
        </div>
      </div>
      <div className="field">
        <label>Hike date</label>
        <input className="input" type="date" value={hikeDate} onChange={(e) => setHikeDate(e.target.value)} />
      </div>
      <div className="field">
        <label>Context (optional)</label>
        <textarea
          className="textarea"
          value={context}
          onChange={(e) => setContext(e.target.value)}
          placeholder="Anything worth knowing about this hike — the people, the route, the vibe…"
        />
      </div>

      <div
        className={`dropzone ${dragging ? 'dragging' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => document.getElementById('file-input')?.click()}
      >
        <input
          id="file-input"
          type="file"
          multiple
          accept={ACCEPTED}
          style={{ display: 'none' }}
          onChange={(e) => addFiles(e.target.files)}
        />
        <div className="dz-icon">⬆</div>
        <p className="dz-title">Drag &amp; drop photos and videos</p>
        <p className="dz-sub">JPG, PNG, WebP, HEIC, MP4, MOV — up to 30 files</p>
      </div>

      <div className="source-divider"><span>OR IMPORT FROM DRIVE</span></div>
      <DrivePicker selected={driveFiles} onChange={setDriveFiles} />

      {files.length > 0 && (
        <div className="file-list">
          {files.map((f, i) => (
            <div className="file-chip" key={i}>
              <span className="small">{f.name}</span>
              <button
                type="button"
                className="file-remove"
                onClick={() => setFiles(files.filter((_, idx) => idx !== i))}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {error && <div className="auth-error">{error}</div>}
      {stage && !error && <div className="stage-note">{stage}</div>}

      <button className="btn btn-primary" style={{ marginTop: 18 }} disabled={loading || !name}>
        {loading ? 'Working…' : (files.length || driveFiles.length) ? 'Analyze & Create' : 'Create project'}
      </button>
    </form>
  );
}
