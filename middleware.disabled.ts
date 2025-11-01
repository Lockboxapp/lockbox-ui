// middleware.ts
export { default } from "next-auth/middleware";

export const config = {
  matcher: ["/((?!api/auth|api/signup|signin|signup|_next|favicon.ico|assets).*)"],
};
