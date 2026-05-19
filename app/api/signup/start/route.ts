// ============================================================
// app/api/signup/start/route.ts
// POST /api/signup/start
//
// Native onboarding v2 — step 1 of the two-step signup. Validates
// the signup fields, creates a temporary SignupSession, and asks
// Twilio Verify to send an OTP. The User is NOT created here — see
// signup/verify. Twilio Verify owns the OTP; the app never sees it.
//
// No auth — the user does not exist yet.
// ============================================================

import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { sendVerification, toE164 } from "@/lib/sms";

export const runtime = "nodejs";

const startSchema = z.object({
  fullName: z.string().trim().min(1).max(120),
  email: z.string().trim().email(),
  password: z.string().min(8),
  phone: z.string().trim().min(1),
  timezone: z.string().trim().max(64).optional().nullable(),
});

// Max signup-start attempts per phone per rolling hour.
const MAX_OTPS_PER_HOUR = 3;

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const parsed = startSchema.safeParse({
      ...body,
      email:
        typeof body?.email === "string" ? body.email.trim().toLowerCase() : "",
    });
    if (!parsed.success) {
      return NextResponse.json(
        {
          error:
            "A valid name, email, password (min 8 characters), and phone are required",
        },
        { status: 400 },
      );
    }

    const { fullName, email, password, timezone } = parsed.data;
    // Store the phone in E.164 so signup/verify can hand it straight
    // to Twilio Verify — the send and check calls must use an
    // identical `To` or the verification won't match.
    const phone = toE164(parsed.data.phone);
    if (!/^\+[1-9]\d{6,14}$/.test(phone)) {
      return NextResponse.json(
        { error: "Enter a valid phone number" },
        { status: 400 },
      );
    }

    // Email must not already belong to a real account.
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { error: "Email already in use" },
        { status: 409 },
      );
    }

    // Rate limit — max 3 signup-start attempts per phone per hour.
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentCount = await prisma.signupSession.count({
      where: { phone, createdAt: { gt: oneHourAgo } },
    });
    if (recentCount >= MAX_OTPS_PER_HOUR) {
      return NextResponse.json(
        { error: "Too many attempts. Try again later." },
        { status: 429 },
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const session = await prisma.signupSession.create({
      data: {
        fullName,
        email,
        passwordHash,
        phone,
        timezone: timezone ?? null,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    });

    // Twilio Verify generates and sends the 6-digit code.
    await sendVerification(phone);

    return NextResponse.json({ signupSessionId: session.sessionId });
  } catch (err) {
    console.error("[POST /api/signup/start]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
