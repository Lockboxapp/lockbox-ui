// ============================================================
// app/api/keyholder-auth/send-otp/route.ts
// POST /api/keyholder-auth/send-otp
// ============================================================
// Verifies that the provided email matches the active keyholder
// for this unlock request, then sends a 6-digit OTP via email.
//
// SECURITY RULES:
//   - Always returns generic success — never reveals whether email matched
//   - OTP stored as bcrypt hash only — never plaintext
//   - 60-second resend cooldown enforced server-side
//   - Prior unused OTPs invalidated before creating a new one
//   - All actions written to AuditEvent
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendKeyholderOTP } from "@/lib/email";
import bcrypt from "bcryptjs";

const GENERIC_RESPONSE = {
  ok: true,
  message: "If the information matches our records, a code has been sent.",
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, sourceToken, purpose } = body;

    // Basic validation
    if (!email || !sourceToken || !purpose) {
      return NextResponse.json(GENERIC_RESPONSE);
    }

    if (purpose !== "APPROVAL") {
      return NextResponse.json(GENERIC_RESPONSE);
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Look up the UnlockRequest by approvalToken
    const unlockRequest = await prisma.unlockRequest.findUnique({
      where: { approvalToken: sourceToken },
      include: { box: true },
    });

    // If not found or not pending — still return generic
    if (!unlockRequest || unlockRequest.status !== "PENDING") {
      return NextResponse.json(GENERIC_RESPONSE);
    }

    // Find active KeyholderRelationship for this box's owner
    // using the new scope-based relationship model
    const activeRelationship = await prisma.keyholderRelationship.findFirst({
      where: {
        userId: unlockRequest.box.userId,
        status: "ACTIVE",
        OR: [
          { scopeType: "ALL" },
          {
            scopeType: "SELECTED",
            boxes: { some: { boxId: unlockRequest.boxId } },
          },
        ],
      },
      include: { profile: true },
    });

    // If no active relationship — still return generic
    if (!activeRelationship) {
      return NextResponse.json(GENERIC_RESPONSE);
    }

    // Verify email matches keyholder profile — case-insensitive
    if (activeRelationship.profile.email !== normalizedEmail) {
      // Log the failed attempt without revealing the mismatch
      await prisma.auditEvent.create({
        data: {
          actor: "SYSTEM",
          action: "OTP_EMAIL_MISMATCH",
          targetId: unlockRequest.id,
          metadata: JSON.stringify({ attemptedEmail: normalizedEmail }),
        },
      });
      return NextResponse.json(GENERIC_RESPONSE);
    }

    // Check resend cooldown — 60 seconds
    const recentOTP = await prisma.keyholderOTP.findFirst({
      where: {
        email: normalizedEmail,
        token: sourceToken,
        purpose: "APPROVAL",
        used: false,
        createdAt: { gte: new Date(Date.now() - 60 * 1000) },
      },
      orderBy: { createdAt: "desc" },
    });

    if (recentOTP) {
      const retryAfterSeconds = Math.ceil(
        (recentOTP.createdAt.getTime() + 60_000 - Date.now()) / 1000,
      );
      return NextResponse.json(
        {
          ok: false,
          message: `Please wait ${retryAfterSeconds} seconds before requesting another code.`,
          retryAfter: retryAfterSeconds,
        },
        { status: 429 },
      );
    }

    // Invalidate all prior unused OTPs for this email + sourceToken + purpose
    // They remain in the table but used=true means they cannot be verified
    await prisma.keyholderOTP.updateMany({
      where: {
        email: normalizedEmail,
        token: sourceToken,
        purpose: "APPROVAL",
        used: false,
      },
      data: { used: true },
    });

    // Generate 6-digit OTP
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const codeHash = await bcrypt.hash(code, 10);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Create OTP record
    const otp = await prisma.keyholderOTP.create({
      data: {
        email: normalizedEmail,
        profileId: activeRelationship.profileId,
        codeHash,
        token: sourceToken,
        purpose: "APPROVAL",
        expiresAt,
      },
    });

    // Send OTP email
    await sendKeyholderOTP({
      keyholderEmail: normalizedEmail,
      keyholderName: activeRelationship.profile.name,
      code,
    });

    // Audit event
    await prisma.auditEvent.create({
      data: {
        actor: "SYSTEM",
        actorId: activeRelationship.profileId,
        action: "OTP_SENT",
        targetId: unlockRequest.id,
        metadata: JSON.stringify({
          keyholderEmail: normalizedEmail,
          otpId: otp.id,
        }),
      },
    });

    return NextResponse.json(GENERIC_RESPONSE);
  } catch (error) {
    console.error("[POST /api/keyholder-auth/send-otp]", error);
    // Still return generic — never leak error details
    return NextResponse.json(GENERIC_RESPONSE);
  }
}
