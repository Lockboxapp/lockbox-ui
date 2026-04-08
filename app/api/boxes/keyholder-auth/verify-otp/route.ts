// ============================================================
// app/api/keyholder-auth/verify-otp/route.ts
// POST /api/keyholder-auth/verify-otp
// ============================================================
// Verifies the OTP code and creates a short-lived session token
// scoped to this specific sourceToken + purpose.
//
// SECURITY RULES:
//   - Attempts incremented BEFORE bcrypt compare
//   - Max 3 attempts before lockout
//   - Generic error messages — no attempt count returned
//   - Session scoped to sourceToken — cannot be reused elsewhere
//   - Session expires in 15 minutes
//   - All actions written to AuditEvent
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, sourceToken, purpose, code } = body;

    if (!email || !sourceToken || !purpose || !code) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    if (purpose !== "APPROVAL") {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Find the most recent unused OTP for this email + sourceToken + purpose
    const otp = await prisma.keyholderOTP.findFirst({
      where: {
        email: normalizedEmail,
        token: sourceToken,
        purpose: "APPROVAL",
        used: false,
      },
      orderBy: { createdAt: "desc" },
    });

    if (!otp) {
      return NextResponse.json(
        { error: "Invalid or expired code. Please request a new one." },
        { status: 401 },
      );
    }

    // Check expiry before incrementing attempts
    if (otp.expiresAt < new Date()) {
      await prisma.keyholderOTP.update({
        where: { id: otp.id },
        data: { used: true },
      });
      return NextResponse.json(
        { error: "Code has expired. Please request a new one." },
        { status: 410 },
      );
    }

    // Increment attempts BEFORE comparing — prevents timing attacks on counter
    const updatedOTP = await prisma.keyholderOTP.update({
      where: { id: otp.id },
      data: { attempts: { increment: 1 } },
    });

    // Lockout check — max 3 attempts
    if (updatedOTP.attempts >= 3) {
      await prisma.keyholderOTP.update({
        where: { id: otp.id },
        data: { used: true },
      });

      await prisma.auditEvent.create({
        data: {
          actor: "SYSTEM",
          actorId: otp.profileId ?? undefined,
          action: "OTP_LOCKOUT",
          targetId: sourceToken,
          metadata: JSON.stringify({ email: normalizedEmail }),
        },
      });

      return NextResponse.json(
        { error: "Too many attempts. Please request a new code." },
        { status: 429 },
      );
    }

    // Compare code against hash
    const valid = await bcrypt.compare(code, otp.codeHash);

    if (!valid) {
      await prisma.auditEvent.create({
        data: {
          actor: "SYSTEM",
          actorId: otp.profileId ?? undefined,
          action: "OTP_FAILED",
          targetId: sourceToken,
          metadata: JSON.stringify({ email: normalizedEmail }),
        },
      });

      return NextResponse.json(
        { error: "Invalid code. Please try again." },
        { status: 401 },
      );
    }

    // Code is valid — mark OTP as used
    await prisma.keyholderOTP.update({
      where: { id: otp.id },
      data: { used: true },
    });

    // Create session — 15 minutes, scoped to this sourceToken
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    const session = await prisma.keyholderSession.create({
      data: {
        email: normalizedEmail,
        profileId: otp.profileId ?? undefined,
        sourceToken,
        purpose: "APPROVAL",
        expiresAt,
      },
    });

    // Audit events
    await prisma.auditEvent.createMany({
      data: [
        {
          actor: "KEYHOLDER",
          actorId: otp.profileId ?? undefined,
          action: "OTP_VERIFIED",
          targetId: sourceToken,
          metadata: JSON.stringify({ email: normalizedEmail }),
        },
        {
          actor: "SYSTEM",
          actorId: otp.profileId ?? undefined,
          action: "SESSION_CREATED",
          targetId: session.id,
          metadata: JSON.stringify({
            email: normalizedEmail,
            expiresAt: expiresAt.toISOString(),
          }),
        },
      ],
    });

    return NextResponse.json({
      ok: true,
      sessionToken: session.sessionToken,
    });
  } catch (error) {
    console.error("[POST /api/keyholder-auth/verify-otp]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
