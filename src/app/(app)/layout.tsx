import './ui.css';
import Link from 'next/link';
import { getSession } from '@/lib/auth-server';
import { UserMenu } from './user-menu';

const NAV = [
  { href: '/projects', label: 'Projects' },
  { href: '/create', label: 'Create' },
  { href: '/library', label: 'Library' },
  { href: '/brand', label: 'Brand' },
  { href: '/settings', label: 'Settings' },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  return (
    <div className="app-shell">
      <header className="topbar">
        <Link href="/projects" className="brand">
          <span className="brand-mark">LH</span>
          <span className="brand-name">Lifestyle Hikers Studio</span>
        </Link>
        <nav className="nav">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="nav-link">
              {n.label}
            </Link>
          ))}
        </nav>
        <UserMenu session={session} />
      </header>
      <main className="main">{children}</main>
    </div>
  );
}
