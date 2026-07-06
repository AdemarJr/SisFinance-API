import { SignJWT, jwtVerify } from 'jose';
import { config } from './config.js';

export interface AuthTokenPayload {
  sub: string;
  email: string;
  authUserId: string;
  isSuperAdmin: boolean;
}

const encoder = new TextEncoder();
const secret = () => encoder.encode(config.jwtSecret);

export async function signAuthToken(payload: AuthTokenPayload): Promise<string> {
  return new SignJWT({
    email: payload.email,
    authUserId: payload.authUserId,
    isSuperAdmin: payload.isSuperAdmin,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secret());
}

export async function verifyAuthToken(token: string): Promise<AuthTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    return {
      sub: String(payload.sub),
      email: String(payload.email ?? ''),
      authUserId: String(payload.authUserId ?? payload.sub),
      isSuperAdmin: Boolean(payload.isSuperAdmin),
    };
  } catch {
    return null;
  }
}

export function getBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader?.startsWith('Bearer ')) return null;
  return authHeader.slice(7).trim() || null;
}
