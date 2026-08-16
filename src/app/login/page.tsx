import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth-server';
import { LoginForm } from './login-form';

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect('/projects');
  return (
    <div className="auth-wrap">
      <div className="auth-card card">
        <div className="brand-mark auth-mark">LH</div>
        <h1 className="auth-title">Lifestyle Hikers Studio</h1>
        <p className="auth-sub">Turn real hiking media into brand-aligned Instagram carousels.</p>
        <LoginForm />
      </div>
    </div>
  );
}
