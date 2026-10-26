import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

import type { Database } from '@/types/database';
import { supabaseEnv } from './env';

/** Pages that need a signed-in customer (cart, checkout, orders, account) — the rest of discovery is public. */
const PRIVATE_PREFIXES = ['/cart', '/checkout', '/orders', '/favorites', '/profile', '/addresses', '/notifications', '/payment-methods', '/restaurant'];
const AUTH_PAGES = ['/login', '/signup', '/forgot-password'];

const isPrivate = (path: string) => PRIVATE_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));

/**
 * Refreshes the Supabase session cookie on each request and redirects signed-out visitors away from
 * private pages. Pages and actions still verify the user server-side; RLS is the real boundary.
 */
export async function updateSession(request: NextRequest) {
  const env = supabaseEnv();
  const path = request.nextUrl.pathname;
  if (!env) return path === '/setup' ? NextResponse.next() : NextResponse.redirect(new URL('/setup', request.url));

  let response = NextResponse.next({ request });
  const supabase = createServerClient<Database>(env.url, env.key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        for (const { name, value } of list) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of list) response.cookies.set(name, value, options);
      },
    },
  });

  // Do not run code between createServerClient and getClaims: it refreshes expired sessions.
  const { data } = await supabase.auth.getClaims();
  const signedIn = typeof data?.claims?.sub === 'string';

  const redirectTo = (to: string) => {
    const res = NextResponse.redirect(new URL(to, request.url));
    for (const c of response.cookies.getAll()) res.cookies.set(c);
    return res;
  };

  if (!signedIn && isPrivate(path)) return redirectTo(`/login?next=${encodeURIComponent(path + request.nextUrl.search)}`);
  if (signedIn && AUTH_PAGES.includes(path)) return redirectTo('/');
  return response;
}
