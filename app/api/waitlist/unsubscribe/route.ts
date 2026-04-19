// ============================================================
// app/api/waitlist/unsubscribe/route.ts
// GET /api/waitlist/unsubscribe?token=<base64(entry.id)>
// ============================================================
// Always returns a plain HTML confirmation (200) so the user never
// sees a broken page regardless of whether the token resolves.
// Sets unsubscribed=true on the matching WaitlistEntry.
// ============================================================

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";

function html(message: string) {
  return new Response(
    `<!doctype html><meta charset="utf-8"><title>Unsubscribed — LockBox</title>
<style>body{font-family:system-ui,sans-serif;max-width:420px;margin:80px auto;padding:0 24px;color:#111;}
p{color:#555;line-height:1.5;}</style>
<h1 style="font-size:20px;margin-bottom:8px;">${message}</h1>
<p>You won't receive any more LockBox emails at this address.</p>
<p style="margin-top:24px;font-size:13px;color:#999;">If this was a mistake, reply to any previous email and we'll add you back.</p>`,
    { status: 200, headers: { "content-type": "text/html; charset=utf-8" } },
  );
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");
  if (!token) return html("You've been unsubscribed.");

  let id: string | null = null;
  try {
    id = Buffer.from(token, "base64").toString("utf8");
  } catch {
    return html("You've been unsubscribed.");
  }

  try {
    await prisma.waitlistEntry.updateMany({
      where: { id },
      data: { unsubscribed: true },
    });
  } catch {
    // Silent — generic confirmation either way to avoid leaking information.
  }

  return html("You've been unsubscribed.");
}
