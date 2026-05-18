// ============================================================
// app/api/kyc/progress/route.ts
// PATCH /api/kyc/progress
//
// Native onboarding v2 — per-field-blur partial save of the KYC
// form so a resuming user keeps their place. SSN is NEVER accepted
// here — it is not in the schema, so zod strips it silently.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getRequestUserId } from "@/lib/mobile-auth";

const progressSchema = z.object({
  legalFirstName: z.string().trim().optional(),
  legalLastName: z.string().trim().optional(),
  dateOfBirth: z.string().trim().optional(),
  addressLine1: z.string().trim().optional(),
  addressLine2: z.string().trim().optional(),
  city: z.string().trim().optional(),
  state: z.string().trim().optional(),
  zip: z.string().trim().optional(),
});

export async function PATCH(req: NextRequest) {
  try {
    const userId = await getRequestUserId(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    // Native sends `address`; the schema field is `addressLine1`. Any
    // `ssn` key is dropped — it's not in progressSchema, so zod strips it.
    const normalized = {
      ...body,
      addressLine1: body?.addressLine1 ?? body?.address,
    };
    const parsed = progressSchema.safeParse(normalized);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }
    const fields = parsed.data;

    // First touch moves NOT_STARTED -> IN_PROGRESS.
    await prisma.user.updateMany({
      where: { id: userId, kycStatus: "NOT_STARTED" },
      data: { kycStatus: "IN_PROGRESS" },
    });

    await prisma.kycData.upsert({
      where: { userId },
      create: { userId, ...fields },
      update: fields,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[PATCH /api/kyc/progress]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
