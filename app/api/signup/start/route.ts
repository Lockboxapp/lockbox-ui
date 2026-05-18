// ============================================================
// app/api/signup/start/route.ts
// POST /api/signup/start
//
// Native onboarding v2 — step 1 of the two-step signup. Validates
// the signup fields, creates a temporary SignupSession holding a
// bcrypt-hashed OTP, sends the OTP by SMS, and returns the session
// id. The User is NOT created here — see signup/verify.
//
// No auth — the user does not exist yet.
// ============================================================

import { NextResponse } from "next/server";
import { randomInt } from "crypto";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { sendOtpSms } from "@/lib/sms";

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
    const phone = parsed.data.phone.replace(/\D/g, "");
    if (phone.length !== 10) {
      return NextResponse.json(
        { error: "Enter a valid 10-digit phone number" },
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
    const otp = String(randomInt(100000, 1000000));
    const otpHash = await bcrypt.hash(otp, 10);

    const session = await prisma.signupSession.create({
      data: {
        fullName,
        email,
        passwordHash,
        phone,
        timezone: timezone ?? null,
        otpHash,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    });

    await sendOtpSms(phone, otp);

    return NextResponse.json({ signupSessionId: session.sessionId });
  } catch (err) {
    console.error("[POST /api/signup/start]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
