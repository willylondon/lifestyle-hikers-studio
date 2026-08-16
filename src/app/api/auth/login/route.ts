import { NextResponse } from 'next/server';
import { findUserByEmail } from '@/lib/users-repo';
import { verifyPassword, loginSchema } from '@/lib/validation';
import { signSession } from '@/lib/session';

const COOKIE_NAME = 'lh_session';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }
    const { email, password } = parsed.data;

    const user = await findUserByEmail(email);
    if (!user || !(await verifyPassword(password, user.password_hash))) {
      return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
    }

    const token = await signSession({ userId: user.id, email: user.email, name: user.name });
    const res = NextResponse.json({ ok: true, userId: user.id });
    res.cookies.set(COOKIE_NAME, token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 7 });
    return res;
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
