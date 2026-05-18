// ============================================================
// app/api/users/me/route.ts
// PATCH /api/users/me
//
// Native onboarding v2 — onboarding-specific user patch, primarily
// the KYC / bank-link skip timestamps. `name` and `timezone` are
// also accepted; the web app's PATCH /api/user/profile is left
// untouched and the two coexist.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getRequestUserId } from "@/lib/mobile-auth";

const patchSchema = z.object({
  skippedKycAt: z.string().datetime().optional(),
  skippedBankLinkAt: z.string().datetime().optional(),
  name: z.string().trim().min(1).max(120).optional(),
  timezone: z.string().trim().max(64).optional(),
});

export async function PATCH(req: NextRequest) {
  try {
    const userId = await getRequestUserId(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const data: Prisma.UserUpdateInput = {};
    if (parsed.data.skippedKycAt) {
      data.skippedKycAt = new Date(parsed.data.skippedKycAt);
    }
    if (parsed.data.skippedBankLinkAt) {
      data.skippedBankLinkAt = new Date(parsed.data.skippedBankLinkAt);
    }
    if (parsed.data.name !== undefined) data.name = parsed.data.name;
    if (parsed.data.timezone !== undefined) data.timezone = parsed.data.timezone;

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }

    await prisma.user.update({ where: { id: userId }, data });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[PATCH /api/users/me]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
