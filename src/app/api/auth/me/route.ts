import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth-server';
import { findUserById } from '@/lib/users-repo';

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ user: null });
  }
  const user = await findUserById(session.userId);
  return NextResponse.json({ user });
}
