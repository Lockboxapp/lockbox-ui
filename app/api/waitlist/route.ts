import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { getServerPosthog } from "@/lib/posthog-server";
import {
  sendWaitlistAdminNotification,
  sendWaitlistEmail1,
} from "@/lib/email";

const schema = z.object({
  email: z.string().email(),
  source: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = schema.safeParse({
      email: typeof body?.email === "string" ? body.email.trim().toLowerCase() : "",
      source: body?.source,
    });

    // Always return generic success — never reveal if email is invalid or already exists
    if (!parsed.success) {
      return NextResponse.json({ ok: true });
    }

    // Detect "first-time signup" before the upsert so we can fire
    // the admin notification only on net-new entries — duplicate
    // submissions stay silent.
    const existing = await prisma.waitlistEntry.findUnique({
      where: { email: parsed.data.email },
      select: { id: true },
    });
    const isNewSignup = existing === null;

    const entry = await prisma.waitlistEntry.upsert({
      where: { email: parsed.data.email },
      update: {},
      create: { email: parsed.data.email },
    });

    // Fire-and-forget admin notification to Darian on new signups.
    // Failure to send must NEVER block the user's signup — wrap in
    // try/catch and swallow with a console.error.
    if (isNewSignup) {
      try {
        const totalCount = await prisma.waitlistEntry.count();
        await sendWaitlistAdminNotification({
          email: entry.email,
          totalCount,
          signedUpAt: entry.createdAt,
        });
      } catch (err) {
        console.error("[waitlist] admin notification failed:", err);
      }
    }

    // Sprint 10 — send Email 1 once. Skip if already sent or the user
    // has unsubscribed. Failure to send must not break signup (swallow).
    if (!entry.email1SentAt && !entry.unsubscribed) {
      try {
        await sendWaitlistEmail1({ to: entry.email, entryId: entry.id });
        await prisma.waitlistEntry.update({
          where: { id: entry.id },
          data: { email1SentAt: new Date() },
        });
      } catch (err) {
        console.error("[waitlist] email1 send failed:", err);
      }
    }

    const ph = getServerPosthog();
    ph.capture({
      distinctId: parsed.data.email,
      event: "waitlist_signup",
      properties: { source: parsed.data.source ?? "unknown" },
    });
    await ph.shutdown();

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}
