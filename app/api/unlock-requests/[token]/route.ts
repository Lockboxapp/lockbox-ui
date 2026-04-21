import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  try {
    const unlockRequest = await prisma.unlockRequest.findUnique({
      where: { approvalToken: token },
      include: {
        box: {
          include: {
            user: { select: { name: true, email: true } },
          },
        },
      },
    });

    if (!unlockRequest) {
      return NextResponse.json(
        { error: "Invalid or expired token" },
        { status: 404 },
      );
    }

    const { approvalToken: _, ...safeRequest } = unlockRequest;

    // Sprint 13 — if this is a TRANSFER request, include the destination box
    // name so the keyholder page can show "to [Destination]" copy.
    let destinationBoxName: string | null = null;
    if (
      safeRequest.requestType === "TRANSFER" &&
      safeRequest.destinationBoxId
    ) {
      const destBox = await prisma.box.findUnique({
        where: { id: safeRequest.destinationBoxId },
        select: { name: true },
      });
      destinationBoxName = destBox?.name ?? null;
    }

    return NextResponse.json({
      id: safeRequest.id,
      status: safeRequest.status,
      reason: safeRequest.reason,
      reflection: safeRequest.reflection,
      requestedAt: safeRequest.requestedAt,
      resolvedAt: safeRequest.resolvedAt,
      cooldownUntil: safeRequest.cooldownUntil,
      requestType: safeRequest.requestType,
      transferAmount:
        safeRequest.transferAmount != null
          ? safeRequest.transferAmount / 100
          : null,
      destinationBoxName,
      box: {
        name: safeRequest.box.name,
        balance: safeRequest.box.balance / 100,
        lockUntil: safeRequest.box.lockUntil,
        status: safeRequest.box.status,
      },
      owner: {
        name: safeRequest.box.user.name,
        email: safeRequest.box.user.email,
      },
    });
  } catch (error) {
    console.error("[GET /api/unlock-requests/:token]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
