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
    "/((?!signin|signup|welcome|intent|onboard-signup|protect|lock|forgot-password|reset-password|keyholder|api/auth|api/signup|api/keyholders|api/unlock-requests|api/keyholder-auth|api/waitlist|api/home|api/boxes|api/transactions|api/banker|api/user|api/transfers|api/cron|_next|favicon.ico)(?!$).*)",
  ],
};
