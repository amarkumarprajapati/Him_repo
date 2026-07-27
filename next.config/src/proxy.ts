import { NextResponse, type NextRequest } from 'next/server';
import { AUTH_COOKIE_NAME } from '@/utils/auth-cookie';

const PROTECTED_PREFIXES = ['/map-view', '/settings', '/profile'];
const AUTH_PAGES = ['/login', '/register', '/forgot-password'];

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;
  const isAuthed = Boolean(token);

  const isProtected = PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
  const isAuthPage = AUTH_PAGES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );

  if (isProtected && !isAuthed) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('from', pathname);
    return NextResponse.redirect(url);
  }

  if (isAuthPage && isAuthed) {
    const url = req.nextUrl.clone();
    url.pathname = '/map-view';
    url.search = '';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon\\.ico|robots\\.txt|sitemap\\.xml|sw\\.js|.*\\.(?:png|jpg|jpeg|svg|webp)).*)',
  ],
};
