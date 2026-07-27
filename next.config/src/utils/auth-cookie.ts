export const AUTH_COOKIE_NAME = 'himshravan_auth';

interface SetCookieOptions {
  maxAge?: number;
  path?: string;
  sameSite?: 'Lax' | 'Strict' | 'None';
  secure?: boolean;
}

function setCookie(name: string, value: string, options: SetCookieOptions = {}) {
  if (typeof document === 'undefined') return;
  const {
    maxAge = 60 * 60 * 24 * 7,
    path = '/',
    sameSite = 'Lax',
    secure = typeof window !== 'undefined' && window.location.protocol === 'https:',
  } = options;
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    `Max-Age=${maxAge}`,
    `Path=${path}`,
    `SameSite=${sameSite}`,
  ];
  if (secure) parts.push('Secure');
  document.cookie = parts.join('; ');
}

function clearCookie(name: string) {
  if (typeof document === 'undefined') return;
  const secure = typeof window !== 'undefined' && window.location.protocol === 'https:';
  let cookieStr = `${name}=; Max-Age=0; Path=/; SameSite=Lax`;
  if (secure) cookieStr += '; Secure';
  document.cookie = cookieStr;
}

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie
    .split('; ')
    .find((c) => c.startsWith(`${name}=`));
  if (!match) return null;
  const value = match.split('=')[1];
  return value ? decodeURIComponent(value) : null;
}

export function setAuthCookie(token: string, options: SetCookieOptions = {}) {
  setCookie(AUTH_COOKIE_NAME, token, options);
}

export function clearAuthCookie() {
  clearCookie(AUTH_COOKIE_NAME);
}

export function readAuthCookie(): string | null {
  return readCookie(AUTH_COOKIE_NAME);
}

