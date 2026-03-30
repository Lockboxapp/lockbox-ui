// ============================================================
// middleware.ts
// Protects all routes under / except auth and keyholder pages
// ============================================================

import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  }
);

export const config = {
  matcher: [
    /*
     * Protect everything EXCEPT:
     *   - /signin, /signup          — auth pages
     *   - /api/auth/*               — NextAuth internals
     *   - /api/keyholders/:token    — keyholder accept (token = auth)
     *   - /api/unlock-requests/*    — approve/deny (token = auth)
     *   - /_next/*, /favicon.ico    — Next.js internals
     */
    "/((?!signin|signup|api/auth|api/signup|api/keyholders|api/unlock-requests|_next|favicon.ico).*)",
  ],
};
