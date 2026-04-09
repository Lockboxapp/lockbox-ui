// ============================================================
// middleware.ts
// Protects all routes under (shell) group
// Public routes: signin, signup, keyholder, api/auth,
//                api/keyholders, api/unlock-requests
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
  },
);

export const config = {
  matcher: [
    "/((?!signin|signup|welcome|intent|onboard-signup|protect|lock|keyholder|api/auth|api/signup|api/keyholders|api/unlock-requests|api/keyholder-auth|_next|favicon.ico).*)",
  ],
};
