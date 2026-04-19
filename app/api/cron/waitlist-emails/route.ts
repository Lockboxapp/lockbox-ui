// ============================================================
// app/api/cron/waitlist-emails/route.ts
// Vercel cron — runs daily at 10am UTC.
// Sends Email 2 on Day 3 and Email 3 on Day 7 of the waitlist sequence.
// ============================================================
// SECURITY: Requires `Authorization: Bearer ${CRON_SECRET}` header.
// Vercel Cron automatically sends this header when CRON_SECRET is configured
// in Vercel env. Returns 401 otherwise.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendWaitlistEmail2, sendWaitlistEmail3 } from "@/lib/email";

// Use node runtime — Resend SDK and Prisma both work here; email loop may take
// longer than edge allows.
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const threeDaysAgo = new Date(now - 3 * day);
  const sevenDaysAgo = new Date(now - 7 * day);

  // Day-3 candidates: Email 1 sent, Email 2 not sent, Email 1 sent >= 3 days ago.
  // Gate on email1SentAt (not createdAt) so the 3-day cadence is measured from
  // the moment the first email actually went out.
  const day3Candidates = await prisma.waitlistEntry.findMany({
    where: {
      unsubscribed: false,
      email1SentAt: { not: null, lte: threeDaysAgo },
      email2SentAt: null,
    },
    select: { id: true, email: true },
  });

  // Day-7 candidates: Email 2 sent, Email 3 not sent, Email 2 sent >= 4 days
  // ago (i.e. Day 7 overall = Day 3 + 4 more). Sequential rule: Email 3
  // requires Email 2 already sent.
  const fourDaysAgo = new Date(now - 4 * day);
  const day7Candidates = await prisma.waitlistEntry.findMany({
    where: {
      unsubscribed: false,
      email2SentAt: { not: null, lte: fourDaysAgo },
      email3SentAt: null,
    },
    select: { id: true, email: true },
  });

  // Sanity: also ensure the Day-7 entry created at least 7 days ago.
  // (If someone got email2 very quickly due to a future tweak, we still
  // respect the original 7-day-since-signup bar via createdAt.)
  const day7Eligible = await prisma.waitlistEntry.findMany({
    where: {
      id: { in: day7Candidates.map((e) => e.id) },
      createdAt: { lte: sevenDaysAgo },
    },
    select: { id: true, email: true },
  });

  let sent2 = 0;
  let sent3 = 0;
  const errors: string[] = [];

  for (const e of day3Candidates) {
    try {
      await sendWaitlistEmail2({ to: e.email, entryId: e.id });
      await prisma.waitlistEntry.update({
        where: { id: e.id },
        data: { email2SentAt: new Date() },
      });
      sent2 += 1;
    } catch (err) {
      errors.push(`email2 to ${e.email}: ${String((err as Error)?.message ?? err)}`);
    }
  }

  for (const e of day7Eligible) {
    try {
      await sendWaitlistEmail3({ to: e.email, entryId: e.id });
      await prisma.waitlistEntry.update({
        where: { id: e.id },
        data: { email3SentAt: new Date() },
      });
      sent3 += 1;
    } catch (err) {
      errors.push(`email3 to ${e.email}: ${String((err as Error)?.message ?? err)}`);
    }
  }

  return NextResponse.json({
    ok: true,
    day3Count: day3Candidates.length,
    day7Count: day7Eligible.length,
    sent2,
    sent3,
    errors,
  });
}
