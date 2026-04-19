// ============================================================
// app/api/admin/reset-password/route.ts
// POST /api/admin/reset-password — ADMIN-ONLY password reset trigger
// ============================================================
// Reuses the forgot-password flow server-side: invalidates old
// tokens, creates a new PasswordResetToken, sends a Resend email.
// Returns generic success to avoid leaking whether a user exists.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const BASE_URL = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
const FROM = "LockBox <noreply@lockboxfinance.com>";
const GENERIC = { ok: true };

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const admin = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { isAdmin: true },
    });
    if (!admin?.isAdmin) {
      return NextResponse.json({ error: "Forbidden — admin only" }, { status: 403 });
    }

    const body = await req.json();
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!email) return NextResponse.json(GENERIC);

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return NextResponse.json(GENERIC);

    await prisma.passwordResetToken.updateMany({
      where: { email, used: false },
      data: { used: true },
    });

    const token = await prisma.passwordResetToken.create({
      data: {
        email,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });

    const resetUrl = `${BASE_URL}/reset-password?token=${token.token}`;

    await resend.emails.send({
      from: FROM,
      to: email,
      subject: "Reset your LockBox password",
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
          <p style="font-weight: bold; font-size: 18px;">🔒 LockBox</p>
          <h2 style="color: #1a1a1a;">Password reset requested</h2>
          <p style="color: #666;">LockBox support initiated a password reset for your account. Click below to set a new password.</p>
          <a href="${resetUrl}" style="display:inline-block;background:#059669;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;margin:16px 0;">Reset password</a>
          <p style="color:#999;font-size:13px;">This link expires in 1 hour. If you didn't request this, ignore this email.</p>
        </div>
      `,
    });

    await prisma.auditEvent.create({
      data: {
        actor: "ADMIN",
        actorId: session.user.id,
        action: "ADMIN_PASSWORD_RESET_TRIGGERED",
        targetId: user.id,
        metadata: JSON.stringify({ email }),
      },
    });

    return NextResponse.json(GENERIC);
  } catch (err) {
    console.error("[POST /api/admin/reset-password]", err);
    return NextResponse.json(GENERIC);
  }
}
