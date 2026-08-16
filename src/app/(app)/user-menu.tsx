import { getSession } from '@/lib/auth-server';

export async function UserMenu({ session }: { session: Awaited<ReturnType<typeof getSession>> }) {
  if (!session) {
    return (
      <a className="btn btn-primary" href="/login">
        Sign in
      </a>
    );
  }
  const initial = (session.name || session.email || '?')[0].toUpperCase();
  return (
    <div className="user-chip">
      <span className="avatar">{initial}</span>
      <span>{session.name || session.email}</span>
    </div>
  );
}
