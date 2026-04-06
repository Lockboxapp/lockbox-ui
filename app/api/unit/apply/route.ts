// ============================================================
// app/api/unit/apply/route.ts
// POST /api/unit/apply — create a Unit application for a user
// ============================================================
// This runs KYC/CIP via Unit. On approval, Unit creates a
// Customer automatically. We store the customerId on the user.
//
// In sandbox, applications approve instantly with test data.
// In production, some applications may require manual review.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createUnitCustomer } from "@/lib/unit";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user already has a Unit customer ID
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, unitCustomerId: true, email: true, name: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (user.unitCustomerId) {
      return NextResponse.json(
        {
          error: "User already has a Unit account",
          unitCustomerId: user.unitCustomerId,
        },
        { status: 409 }
      );
    }

    const body = await req.json();
    const {
      firstName,
      lastName,
      phone,
      ssn,
      dateOfBirth,
      occupation,
      annualIncome,
      sourceOfIncome,
      address,
    } = body;
    // Validate required fields
    if (
      !firstName ||
      !lastName ||
      !phone ||
      !ssn ||
      !dateOfBirth ||
      !occupation ||
      !address
    ) {
      return NextResponse.json(
        {
          error:
            "firstName, lastName, phone, ssn, dateOfBirth, and address are required",
        },
        { status: 400 }
      );
    }

    // Create Unit application — runs KYC/CIP
    const result = await createUnitCustomer({
      firstName,
      lastName,
      email: user.email!,
      phone,
      ssn,
      dateOfBirth,
      occupation,
      address,
      annualIncome,
      sourceOfIncome,
    });

    // Unit returns the application ID — in sandbox this auto-approves
    // and creates a customer. The customer ID comes back as the data.id
    // when the type is "individualCustomer"
    const unitCustomerId = result.data.id;

    // Store the Unit customer ID on the user
    await prisma.user.update({
      where: { id: session.user.id },
      data: { unitCustomerId },
    });

    return NextResponse.json({
      ok: true,
      unitCustomerId,
      type: result.data.type,
    });
  } catch (error: any) {
    console.error("[POST /api/unit/apply]", error);
    return NextResponse.json(
      { error: error.message ?? "Internal server error" },
      { status: 500 }
    );
  }
}
