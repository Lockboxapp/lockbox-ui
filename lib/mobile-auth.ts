// ============================================================
// lib/mobile-auth.ts
// Unified request-level auth resolver that works for both the
// web app (NextAuth session cookie) and the native app
// (Authorization: Bearer <token>).
//
// `getToken({ req })` from next-auth/jwt already inspects both the
// session cookie AND the Authorization header, so the only thing
// callers have to do is swap `getServerSession(authOptions)` for
// `getRequestUserId(req)` and consume the returned id.
//
// Tokens for the native app are minted by POST /api/auth/mobile/token
// using the same NEXTAUTH_SECRET, so a single verification path
// covers both surfaces.
// ============================================================

import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

/**
 * Returns the authenticated user's id for the given request.
 * - Web requests resolve via the NextAuth session cookie.
 * - Native requests resolve via the `Authorization: Bearer <jwt>` header.
 * Returns `null` when the request is unauthenticated.
 */
export async function getRequestUserId(
  req: NextRequest,
): Promise<string | null> {
  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
  });
  if (!token) return null;
  // lib/auth.ts sets `uid` in the JWT callback at login. Fall back to
  // `sub` for tokens minted before that callback (defensive only).
  const uid =
    (token.uid as string | undefined) ?? (token.sub as string | undefined);
  return uid ?? null;
}
