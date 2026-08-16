'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

type InstagramStatus = {
  configured: boolean;
  connected: boolean;
  username?: string;
  accountType?: string;
  expiresAt?: string | null;
};

export function SettingsView() {
  const router = useRouter();
  const params = useSearchParams();
  const [instagram, setInstagram] = useState<InstagramStatus | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);

  async function loadInstagram() {
    const res = await fetch('/api/integrations/instagram/status', { cache: 'no-store' });
    const data = await res.json();
    setInstagram(data);
  }

  useEffect(() => { void loadInstagram(); }, []);

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  async function disconnectInstagram() {
    setDisconnecting(true);
    await fetch('/api/integrations/instagram/disconnect', { method: 'POST' });
    await loadInstagram();
    setDisconnecting(false);
  }

  const message = params.get('instagram');
  const errorMessage = params.get('message');

  return (
    <div className="grid grid-2">
      <div className="card">
        <h3>Instagram publishing</h3>
        <p className="muted">Connect the @LifestyleHikers Professional account through Meta. Other Instagram accounts are rejected, and your Instagram password is never shared with this app.</p>
        {message === 'connected' && <div className="badge badge-accent" style={{ marginTop: 12 }}>Instagram connected ✓</div>}
        {message === 'error' && <div className="auth-error" style={{ marginTop: 12 }}>{errorMessage || 'Instagram connection failed.'}</div>}

        {!instagram ? (
          <p className="muted small" style={{ marginTop: 14 }}>Checking connection…</p>
        ) : !instagram.configured ? (
          <div className="auth-error" style={{ marginTop: 14 }}>Meta credentials are not configured on this deployment.</div>
        ) : instagram.connected ? (
          <div style={{ marginTop: 16 }}>
            <div className="flex-between">
              <div>
                <div style={{ fontWeight: 700 }}>@{instagram.username || 'Instagram account'}</div>
                <div className="muted small">{instagram.accountType || 'Professional account'}</div>
              </div>
              <span className="badge badge-accent">Connected</span>
            </div>
            {instagram.expiresAt && <p className="faint small" style={{ marginTop: 10 }}>Authorization expiry: {new Date(instagram.expiresAt).toLocaleDateString()}</p>}
            <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
              <a className="btn" href="/api/integrations/instagram/start">Reconnect Instagram</a>
              <button className="btn btn-danger" onClick={disconnectInstagram} disabled={disconnecting}>{disconnecting ? 'Disconnecting…' : 'Disconnect'}</button>
            </div>
          </div>
        ) : (
          <a className="btn btn-primary" href="/api/integrations/instagram/start" style={{ marginTop: 16 }}>Connect @LifestyleHikers</a>
        )}
      </div>

      <div className="card">
        <h3>Publishing workflow</h3>
        <p className="muted">Create the carousel, review every slide and caption, approve it, then publish directly to the connected Instagram account.</p>
        <div className="faint small" style={{ marginTop: 14, lineHeight: 1.8 }}>
          Google Drive / Upload → Enhance → Ideas → Carousel → Review → Approve → Publish
        </div>
      </div>

      <div className="card">
        <h3>Account</h3>
        <p className="muted">Manage your Lifestyle Hikers Studio session.</p>
        <button className="btn btn-danger" onClick={logout} style={{ marginTop: 12 }}>Sign out</button>
      </div>

      <div className="card">
        <h3>Security</h3>
        <p className="muted">Instagram access tokens are encrypted at rest. Meta OAuth is used instead of collecting Instagram passwords. Publishing still requires explicit carousel approval.</p>
      </div>
    </div>
  );
}
