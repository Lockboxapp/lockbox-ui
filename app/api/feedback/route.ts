// ============================================================
// app/api/feedback/route.ts
// POST — send user feedback or bug report to darian@lockboxfinance.com
// ============================================================
// Body: { subject, message, kind: "feedback" | "bug" }
// From: LockBox <noreply@lockboxfinance.com>
// Reply-to: the user's email so Darian can reply directly.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Resend } from "resend";
import { z } from "zod";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = "LockBox <noreply@lockboxfinance.com>";
const DEST = "darian@lockboxfinance.com";

const bodySchema = z.object({
  subject: z.string().trim().min(1).max(200),
  message: z.string().trim().min(1).max(5000),
  kind: z.enum(["feedback", "bug"]).default("feedback"),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { name: true, email: true, id: true },
    });

    const kindLabel = parsed.data.kind === "bug" ? "Bug" : "Feedback";
    const subjectPrefix = `[LockBox ${kindLabel}]`;
    const subject = `${subjectPrefix} ${parsed.data.subject}`;
    const text = `From: ${user?.name ?? "—"} <${user?.email ?? "unknown"}>
User ID: ${user?.id ?? "—"}
Kind: ${kindLabel}
Subject: ${parsed.data.subject}

${parsed.data.message}`;

    await resend.emails.send({
      from: FROM,
      to: DEST,
      subject,
      text,
      replyTo: user?.email ?? undefined,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[POST /api/feedback]", err);
    return NextResponse.json(
      { error: "Could not send. Please try again." },
      { status: 500 },
    );
  }
}
