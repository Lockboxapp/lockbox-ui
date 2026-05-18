// ============================================================
// app/api/kyc/submit/route.ts
// POST /api/kyc/submit
//
// Native onboarding v2 — accepts the KYC form, stores it in
// KycData, and moves the user to kycStatus = PENDING_REVIEW.
//
// v1 does NOT call Unit BaaS (User.unitCustomerId is the future
// hook). The full SSN is never persisted — only the last 4 digits.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getRequestUserId } from "@/lib/mobile-auth";
import { getServerPosthog } from "@/lib/posthog-server";

const submitSchema = z.object({
  legalFirstName: z.string().trim().min(1),
  legalLastName: z.string().trim().min(1),
  dateOfBirth: z.string().trim().min(1),
  addressLine1: z.string().trim().min(1),
  addressLine2: z.string().trim().optional().nullable(),
  city: z.string().trim().min(1),
  state: z.string().trim().min(1),
  zip: z.string().trim().min(1),
  ssn: z.string().trim().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const userId = await getRequestUserId(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    // Native sends `address`; the schema field is `addressLine1`.
    const normalized = {
      ...body,
      addressLine1: body?.addressLine1 ?? body?.address,
    };
    const parsed = submitSchema.safeParse(normalized);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Please complete all required identity fields." },
        { status: 400 },
      );
    }
    const d = parsed.data;

    // Validate SSN format (9 digits, dashed or not). Store last 4 only —
    // the full SSN is never written to the database.
    const ssnDigits = d.ssn.replace(/\D/g, "");
    if (ssnDigits.length !== 9) {
      return NextResponse.json(
        { error: "Enter a valid Social Security number." },
        { status: 400 },
      );
    }
    const ssnLast4 = ssnDigits.slice(-4);

    const fields = {
      legalFirstName: d.legalFirstName,
      legalLastName: d.legalLastName,
      dateOfBirth: d.dateOfBirth,
      addressLine1: d.addressLine1,
      addressLine2: d.addressLine2 ?? null,
      city: d.city,
      state: d.state,
      zip: d.zip,
      ssnLast4,
      submittedAt: new Date(),
    };

    await prisma.kycData.upsert({
      where: { userId },
      create: { userId, ...fields },
      update: fields,
    });
    await prisma.user.update({
      where: { id: userId },
      data: { kycStatus: "PENDING_REVIEW" },
    });

    const ph = getServerPosthog();
    ph.capture({ distinctId: userId, event: "kyc_submitted" });
    await ph.shutdown();

    return NextResponse.json({ ok: true, kycStatus: "PENDING_REVIEW" });
  } catch (err) {
    console.error("[POST /api/kyc/submit]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
