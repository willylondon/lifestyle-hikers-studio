import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth-server';
import { CreateForm } from './create-form';

export default async function CreatePage() {
  const session = await getSession();
  if (!session) redirect('/login');
  return (
    <div>
      <div className="page-head">
        <h1 className="page-title">Create a campaign</h1>
        <p className="page-sub">Start with a hike. The studio handles the rest.</p>
      </div>
      <CreateForm />
    </div>
  );
}
