import { SignJWT, jwtVerify } from 'jose';
import { config } from './config';

const secret = new TextEncoder().encode(config.sessionSecret);
const alg = 'HS256';

export interface SessionPayload {
  userId: string;
  email: string;
  name?: string;
}

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secret);
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}
