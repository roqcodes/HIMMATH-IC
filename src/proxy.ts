import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';
import { env } from '@/lib/env';
import { authSessionSlug } from '@/lib/icTransfer/warehouseSlug';
import {
  ASIC_PORTALS,
  RESERVED_BRANCH_SLUGS,
  loginPath,
  postLoginPathForRole,
  type AsicPortal,
} from '@/lib/asic/routing';

/**
 * Entry-point redirects run here rather than in a page, because every top-level route sits
 * behind a `loading.tsx` boundary. That makes the page a streaming context, where
 * `redirect()` cannot emit a 307 and instead hands the redirect to the client router. The
 * client then performs an MPA navigation, which makes Next's own `Router` throw mid-render
 * and rerender with a different hook count (React error #310).
 *
 * Redirecting here happens before rendering starts, so the browser gets a real 307 and the
 * client router never sees a URL it has to navigate away from. The page-level
 * `requirePortalUser` guards stay in place — this only hoists the redirect, it does not
 * grant access.
 */

const sessionKey = new TextEncoder().encode(env.SESSION_SECRET);

const BRANCH_PORTALS = new Set<string>(ASIC_PORTALS.filter(portal => portal !== 'admin'));

type ProxySession = {
  role?: string;
  expiresAt?: string;
};

async function readSession(request: NextRequest, slug?: string): Promise<ProxySession | null> {
  const sessionSlug = authSessionSlug(slug);
  const token = request.cookies.get(sessionSlug ? `session_${sessionSlug}` : 'session_superadmin')?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, sessionKey, { algorithms: ['HS256'] });
    const session = payload as ProxySession;
    if (session.expiresAt && new Date(session.expiresAt) < new Date()) return null;
    return session;
  } catch {
    return null;
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const to = (path: string) => NextResponse.redirect(new URL(path, request.url));

  if (pathname === '/') {
    return to('/admin');
  }

  const segments = pathname.split('/').filter(Boolean);
  const [first, second] = segments;

  if (first === 'admin') {
    const session = await readSession(request);
    if (segments.length === 1) {
      return landingRedirect(session, 'admin', undefined, to);
    }
    return session ? NextResponse.next() : to('/admin');
  }

  if (BRANCH_PORTALS.has(first) && second && !RESERVED_BRANCH_SLUGS.has(second)) {
    const portal = first as AsicPortal;
    const session = await readSession(request, second);
    if (segments.length === 2) {
      return landingRedirect(session, portal, second, to);
    }
    if (!session) return to(loginPath(second, portal));
  }

  return NextResponse.next();
}

/**
 * Portal landing pages ("/admin", "/branch/acme") show the sign-in form when there is no
 * session and forward to the role's home when there is one. Only redirect when that home
 * stays inside the same portal: the cross-portal cases depend on a branch lookup that this
 * proxy deliberately avoids, so those are left to the page.
 */
function landingRedirect(
  session: ProxySession | null,
  portal: AsicPortal,
  slug: string | undefined,
  to: (path: string) => NextResponse,
) {
  if (!session?.role) return NextResponse.next();

  const home = postLoginPathForRole(session.role, slug);
  const portalPrefix = slug ? `/${portal}/${slug}/` : `/${portal}/`;
  return home.startsWith(portalPrefix) ? to(home) : NextResponse.next();
}

export const config = {
  // Skip API routes, RSC/static assets and public files — only page navigations matter here.
  matcher: ['/((?!api|_next/static|_next/image|.*\\..*).*)'],
};
