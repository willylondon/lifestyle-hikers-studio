import { NextResponse } from 'next/server';
import { createUser, findUserByEmail } from '@/lib/users-repo';
import { newId, nowIso } from '@/lib/ids';
import { hashPassword, registerSchema } from '@/lib/validation';
import { signSession } from '@/lib/session';

const COOKIE_NAME = 'lh_session';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
    }
    const { email, password, name } = parsed.data;

    const existing = await findUserByEmail(email);
    if (existing) {
      return NextResponse.json({ error: 'An account with this email already exists.' }, { status: 409 });
    }

    const id = newId('usr');
    const hash = await hashPassword(password);
    await createUser({ id, email, name: name ?? '', password_hash: hash, created_at: nowIso() });

    const token = await signSession({ userId: id, email, name });
    const res = NextResponse.json({ ok: true, userId: id });
    res.cookies.set(COOKIE_NAME, token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 7 });
    return res;
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function GET() {
  // Login is POST; placeholder.
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}
