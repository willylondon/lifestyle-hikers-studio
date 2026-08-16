import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth-server';
import { SettingsView } from './settings-view';

export default async function SettingsPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  return (
    <div>
      <div className="page-head">
        <h1 className="page-title">Settings</h1>
        <p className="page-sub">Account connections and publishing.</p>
      </div>
      <SettingsView />
    </div>
  );
}
