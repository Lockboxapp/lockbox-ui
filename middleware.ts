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
    "/((?!signin|signup|api/auth|api/signup|api/keyholders|/keyholder/accept|keyholder|api/unlock-requests|_next|favicon.ico).*)",
  ],
};
