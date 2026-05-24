// ============================================================
// app/api/signup/resend-otp/route.ts
// POST /api/signup/resend-otp
//
// Native onboarding v2 — re-sends the OTP for an existing signup
// session via Twilio Verify and refreshes the session's 10-minute
// window / attempt counter.
//
// No auth — the user does not exist yet.
// ============================================================

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendVerification } from "@/lib/sms";

export const runtime = "nodejs";

// Max signup attempts per phone per rolling hour (matches signup/start).
const MAX_OTPS_PER_HOUR = 3;

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const signupSessionId =
      typeof body?.signupSessionId === "string" ? body.signupSessionId : "";
    if (!signupSessionId) {
      return NextResponse.json(
        { error: "signupSessionId is required" },
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

    // Rate limit — same 3 signup-attempts-per-phone-per-hour check.
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentCount = await prisma.signupSession.count({
      where: { phone: session.phone, createdAt: { gt: oneHourAgo } },
    });
    if (recentCount >= MAX_OTPS_PER_HOUR) {
      return NextResponse.json(
        { error: "Too many attempts. Try again later." },
        { status: 429 },
      );
    }

    // Refresh the session window + attempt counter.
    await prisma.signupSession.update({
      where: { id: session.id },
      data: {
        otpAttempts: 0,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    });

    // Twilio Verify issues a fresh code. Capture the new SID and
    // overwrite the prior one so signup/verify checks by the live
    // verification, not a superseded one.
    const { sid } = await sendVerification(session.phone);
    if (sid) {
      await prisma.signupSession.update({
        where: { id: session.id },
        data: { twilioVerificationSid: sid },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[POST /api/signup/resend-otp]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
