// ============================================================
// app/api/keyholders/[token]/route.ts
// PATCH /api/keyholders/:token  — keyholder accepts their role
// ============================================================
// The token here is the inviteToken from the keyholder invite email.
// This route does NOT require auth — the token IS the auth.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const keyholder = await prisma.keyholder.findUnique({
      where: { inviteToken: params.token },
      include: { box: true },
    });

    if (!keyholder) {
      return NextResponse.json(
        { error: "Invalid or expired invite token" },
        { status: 404 }
      );
    }

    if (keyholder.accepted) {
      return NextResponse.json(
        { error: "Invite already accepted" },
        { status: 409 }
      );
    }

    await prisma.keyholder.update({
      where: { id: keyholder.id },
      data: { accepted: true },
    });

    // Return just enough for the UI to confirm acceptance
    return NextResponse.json({
      accepted: true,
      boxName: keyholder.box.name,
    });
  } catch (error) {
    console.error("[PATCH /api/keyholders/:token]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
