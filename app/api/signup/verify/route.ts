// ============================================================
// app/api/signup/verify/route.ts
// POST /api/signup/verify
//
// Native onboarding v2 — step 2 of the two-step signup. Verifies
// the OTP via Twilio Verify, creates the real User (with starter
// vaults + system Wallet box, matching /api/signup), mints a mobile
// Bearer token, and deletes the temporary session.
//
// No auth — the user does not exist until this route succeeds.
// ============================================================

import { NextResponse } from "next/server";
import { encode } from "next-auth/jwt";
import { prisma } from "@/lib/db";
import { sendWelcomeEmail } from "@/lib/email";
import { getServerPosthog } from "@/lib/posthog-server";
import { checkVerification } from "@/lib/sms";

export const runtime = "nodejs";

// 30-day TTL — matches POST /api/auth/mobile/token.
const TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;
const MAX_OTP_ATTEMPTS = 5;

export async function POST(req: Request) {
  try {
    const secret = process.env.NEXTAUTH_SECRET;
    if (!secret) {
      console.error("[POST /api/signup/verify] NEXTAUTH_SECRET is not set");
      return NextResponse.json(
        { error: "Server misconfigured" },
        { status: 500 },
      );
    }

    const body = await req.json().catch(() => ({}));
    const signupSessionId =
      typeof body?.signupSessionId === "string" ? body.signupSessionId : "";
    // Native sends `code`; the backend spec calls it `otp`. Accept either.
    const submittedOtp =
      typeof body?.otp === "string"
        ? body.otp
        : typeof body?.code === "string"
          ? body.code
          : "";

    if (!signupSessionId || !submittedOtp) {
      return NextResponse.json(
        { error: "signupSessionId and code are required" },
        { status: 400 },
      );
    }

    const session = await prisma.signupSession.findUnique({
      where: { sessionId: signupSessionId },
    });
    if (!session) {
      return NextResponse.json(
        { error: "Signup session not found" },
        { status: 404 },
      );
    }

    // Expired — discard the session.
    if (session.expiresAt.getTime() < Date.now()) {
      await prisma.signupSession.delete({ where: { id: session.id } });
      return NextResponse.json({ error: "Code expired" }, { status: 410 });
    }

    // Too many wrong attempts — discard the session.
    if (session.otpAttempts >= MAX_OTP_ATTEMPTS) {
      await prisma.signupSession.delete({ where: { id: session.id } });
      return NextResponse.json(
        { error: "Too many attempts" },
        { status: 429 },
      );
    }

    // Record this attempt before checking the code.
    await prisma.signupSession.update({
      where: { id: session.id },
      data: { otpAttempts: { increment: 1 } },
    });

    const otpValid = await checkVerification(session.phone, submittedOtp);
    if (!otpValid) {
      return NextResponse.json({ error: "Invalid code" }, { status: 400 });
    }

    // Create the real user. Guard against the email being claimed in
    // the window since signup/start (e.g. a concurrent web signup).
    let user: { id: string; name: string | null; email: string | null };
    try {
      user = await prisma.user.create({
        data: {
          name: session.fullName,
          email: session.email,
          passwordHash: session.passwordHash,
          phone: session.phone,
          timezone: session.timezone,
        },
        select: { id: true, name: true, email: true },
      });
    } catch (err) {
      if ((err as { code?: string })?.code === "P2002") {
        await prisma.signupSession.delete({ where: { id: session.id } });
        return NextResponse.json(
          { error: "Email already in use" },
          { status: 409 },
        );
      }
      throw err;
    }

    // Starter vaults + system Wallet box — same shape as /api/signup.
    await prisma.$transaction([
      prisma.vault.create({
        data: {
          userId: user.id,
          name: "Rent safe-deposit box",
          balance: 1200,
        },
      }),
      prisma.vault.create({
        data: { userId: user.id, name: "Emergency fund", balance: 850 },
      }),
      prisma.box.create({
        data: {
          userId: user.id,
          name: "Wallet",
          status: "CREATED",
          lockType: "SOFT",
          isWallet: true,
          isClosed: false,
          balance: 0,
          lockedAmount: 0,
        },
      }),
    ]);

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

    // Session consumed.
    await prisma.signupSession.delete({ where: { id: session.id } });

    const ph = getServerPosthog();
    ph.capture({ distinctId: user.id, event: "user_signed_up" });
    await ph.shutdown();

    // Welcome email — non-blocking.
    try {
      await sendWelcomeEmail({
        userEmail: session.email,
        userName: session.fullName,
      });
    } catch (err) {
      console.error("[signup/verify] welcome email failed:", err);
    }

    // Flat fields for the native client (SignupVerifyResult); nested
    // `user` object for parity with the backend spec.
    return NextResponse.json({
      token,
      userId: user.id,
      email: user.email,
      name: user.name,
      user: { id: user.id, name: user.name, email: user.email },
    });
  } catch (err) {
    console.error("[POST /api/signup/verify]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
