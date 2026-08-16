import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth-server';
import { RECURRING_SERIES } from '@/concepts/engine';
import { CONTENT_PILLARS } from '@/concepts/engine';
import './brand.css';

export default async function BrandPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  return (
    <div>
      <div className="page-head">
        <h1 className="page-title">Brand</h1>
        <p className="page-sub">Lifestyle Hikers — one foot in front the other.</p>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <h3>Brand identity</h3>
        <p className="muted">
          Handle: <strong>@LifestyleHikers</strong> · Philosophy: <em>One foot in front the other.</em>
        </p>
        <p className="muted">
          The people are as important as the destination. Community, movement, wellness, discovery — and a
          recognizable Jamaican outdoor-media brand.
        </p>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <h3>Content pillars</h3>
          <div className="pill-list">
            {CONTENT_PILLARS.map((p) => (
              <span key={p} className="pill">{p}</span>
            ))}
          </div>
        </div>
        <div className="card">
          <h3>Recurring series</h3>
          <div className="series-list">
            {RECURRING_SERIES.map((s) => (
              <div key={s.name} className="series-item">
                <span className="series-name">{s.name}</span>
                <span className="faint small">{s.description}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
