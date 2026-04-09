import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const BASE_URL = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
const FROM = "LockBox <noreply@lockboxfinance.com>";
const GENERIC = {
  ok: true,
  message: "If that email exists, a reset link has been sent.",
};

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!email) return NextResponse.json(GENERIC);

    const normalizedEmail = email.toLowerCase().trim();
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (!user) return NextResponse.json(GENERIC);

    await prisma.passwordResetToken.updateMany({
      where: { email: normalizedEmail, used: false },
      data: { used: true },
    });

    const token = await prisma.passwordResetToken.create({
      data: {
        email: normalizedEmail,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });

    const resetUrl = `${BASE_URL}/reset-password?token=${token.token}`;

    await resend.emails.send({
      from: FROM,
      to: normalizedEmail,
      subject: "Reset your LockBox password",
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
          <p style="font-weight: bold; font-size: 18px;">🔒 LockBox</p>
          <h2 style="color: #1a1a1a;">Reset your password</h2>
          <p style="color: #666;">You requested a password reset. Click below to set a new password.</p>
          <a href="${resetUrl}" style="display:inline-block;background:#059669;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;margin:16px 0;">Reset password</a>
          <p style="color:#999;font-size:13px;">This link expires in 1 hour. If you didn't request this, ignore this email.</p>
          <p style="color:#999;font-size:12px;font-style:italic;">"Stay consistent." — The Banker</p>
        </div>
      `,
    });

    return NextResponse.json(GENERIC);
  } catch (error) {
    console.error("[POST /api/auth/forgot-password]", error);
    return NextResponse.json(GENERIC);
  }
}
