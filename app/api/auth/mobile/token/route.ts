// ============================================================
// app/api/auth/mobile/token/route.ts
// POST /api/auth/mobile/token
// Mints a NextAuth-compatible JWT for the native app.
//
// The web app uses NextAuth's session-cookie flow and never hits
// this endpoint. The native app cannot use browser cookies, so it
// exchanges email + password here for a JWT that:
//   - is signed/encrypted with the same NEXTAUTH_SECRET
//   - mirrors the cookie payload set by lib/auth.ts (uid, sub, name, email)
//   - is verified by `getRequestUserId` via `getToken({ req })` so a
//     single server-side path covers both surfaces.
//
// SECURITY:
//   - Same bcrypt + isRestricted gates as the Credentials provider
//     in lib/auth.ts. Diverging here would create an auth bypass.
//   - 30-day TTL. Mobile is responsible for storing the token in
//     expo-secure-store and discarding it on logout.
//   - 401 leaks no information beyond "Invalid credentials".
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { encode } from "next-auth/jwt";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

const TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days

export async function POST(req: NextRequest) {
  try {
    const secret = process.env.NEXTAUTH_SECRET;
    if (!secret) {
      console.error(
        "[POST /api/auth/mobile/token] NEXTAUTH_SECRET is not set",
      );
      return NextResponse.json(
        { error: "Server misconfigured" },
        { status: 500 },
      );
    }

    const body = await req.json().catch(() => ({}));
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body?.password === "string" ? body.password : "";

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 },
      );
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.passwordHash) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 },
      );
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 },
      );
    }

    if (user.isRestricted) {
      return NextResponse.json(
        {
          error:
            "Account restricted. Contact support@lockboxfinance.com",
          code: "account_restricted",
        },
        { status: 403 },
      );
    }

    const token = await encode({
      token: {
        uid: user.id,
        sub: user.id,
        name: user.name ?? null,
        email: user.email ?? null,
      },
      secret,
      maxAge: TOKEN_TTL_SECONDS,
    });

    return NextResponse.json({
      token,
      userId: user.id,
      email: user.email,
      name: user.name,
      expiresInSeconds: TOKEN_TTL_SECONDS,
    });
  } catch (err) {
    console.error("[POST /api/auth/mobile/token]", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
